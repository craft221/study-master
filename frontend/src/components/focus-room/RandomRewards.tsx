'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Gift, Sparkles, Zap, Star, Trophy, Flame, Diamond } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/LanguageContext'

interface Reward {
  id: string
  type: 'xp' | 'badge' | 'streak_saver' | 'multiplier' | 'mystery'
  name: string
  description: string
  emoji: string
  value: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

const RARITY_CONFIG = {
  common: { color: 'from-gray-400 to-gray-500', glow: 'shadow-gray-500/30', chance: 0.5 },
  rare: { color: 'from-blue-400 to-blue-600', glow: 'shadow-blue-500/30', chance: 0.3 },
  epic: { color: 'from-purple-400 to-purple-600', glow: 'shadow-purple-500/30', chance: 0.15 },
  legendary: { color: 'from-yellow-400 to-orange-500', glow: 'shadow-yellow-500/50', chance: 0.05 },
}

interface RandomRewardsProps {
  isActive: boolean
  focusMinutes: number
  onRewardClaimed?: (reward: Reward) => void
  className?: string
}

export default function RandomRewards({ isActive, focusMinutes, onRewardClaimed, className }: RandomRewardsProps) {
  const { t } = useTranslation()
  const [pendingReward, setPendingReward] = useState<Reward | null>(null)
  const [claimedRewards, setClaimedRewards] = useState<Reward[]>([])
  const [isOpening, setIsOpening] = useState(false)
  const [lastRewardMinute, setLastRewardMinute] = useState(0)

  const POSSIBLE_REWARDS: Omit<Reward, 'id'>[] = useMemo(() => [
    { type: 'xp', name: t('focusRoom.rewards.bonusXp'), description: t('focusRoom.rewards.descBonus15'), emoji: '✨', value: 15, rarity: 'common' },
    { type: 'xp', name: t('focusRoom.rewards.superBonus'), description: t('focusRoom.rewards.descBonus30'), emoji: '💫', value: 30, rarity: 'rare' },
    { type: 'xp', name: t('focusRoom.rewards.megaBonus'), description: t('focusRoom.rewards.descBonus50'), emoji: '⭐', value: 50, rarity: 'epic' },
    { type: 'xp', name: t('focusRoom.rewards.jackpot'), description: t('focusRoom.rewards.descBonus100'), emoji: '🌟', value: 100, rarity: 'legendary' },
    { type: 'multiplier', name: t('focusRoom.rewards.doubleXp'), description: t('focusRoom.rewards.descDouble'), emoji: '🔥', value: 2, rarity: 'rare' },
    { type: 'multiplier', name: t('focusRoom.rewards.tripleXp'), description: t('focusRoom.rewards.descTriple'), emoji: '💎', value: 3, rarity: 'epic' },
    { type: 'streak_saver', name: t('focusRoom.rewards.streakShield'), description: t('focusRoom.rewards.descStreakShield'), emoji: '🛡️', value: 1, rarity: 'rare' },
    { type: 'badge', name: t('focusRoom.rewards.focusBadge'), description: t('focusRoom.rewards.descFocusBadge'), emoji: '🏅', value: 1, rarity: 'epic' },
    { type: 'mystery', name: t('focusRoom.rewards.mysteryChest'), description: t('focusRoom.rewards.descMystery'), emoji: '🎁', value: 1, rarity: 'legendary' },
  ], [t])

  // Check for random rewards every 5 minutes of focus
  useEffect(() => {
    if (!isActive) return

    const minutesSinceLastReward = focusMinutes - lastRewardMinute

    // 20% chance every 5 minutes
    if (minutesSinceLastReward >= 5 && !pendingReward) {
      if (Math.random() < 0.2) {
        generateReward()
        setLastRewardMinute(focusMinutes)
      }
    }
  }, [focusMinutes, isActive, lastRewardMinute, pendingReward])

  const generateReward = useCallback(() => {
    // Weighted random selection based on rarity
    // First, select a rarity based on chances
    const rand = Math.random()
    let cumulative = 0
    let selectedRarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common'

    for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
      cumulative += config.chance
      if (rand <= cumulative) {
        selectedRarity = rarity as typeof selectedRarity
        break
      }
    }

    // Then, select a random reward from that rarity
    const rewardsOfRarity = POSSIBLE_REWARDS.filter(r => r.rarity === selectedRarity)
    const selected = rewardsOfRarity[Math.floor(Math.random() * rewardsOfRarity.length)] || POSSIBLE_REWARDS[0]

    const reward: Reward = {
      ...selected,
      id: Date.now().toString()
    }

    setPendingReward(reward)

    // Play sound
    const audio = new Audio('/sounds/reward.mp3')
    audio.play().catch(() => {})

    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100])
    }
  }, [POSSIBLE_REWARDS])

  const claimReward = () => {
    if (!pendingReward) return

    setIsOpening(true)

    // Dramatic reveal animation
    setTimeout(() => {
      setClaimedRewards(prev => [...prev, pendingReward])
      onRewardClaimed?.(pendingReward)
      setIsOpening(false)
      setPendingReward(null)
    }, 1500)
  }

  const rarityConfig = pendingReward ? RARITY_CONFIG[pendingReward.rarity] : null

  return (
    <div className={cn("relative", className)}>
      {/* Pending Reward Popup */}
      <AnimatePresence>
        {pendingReward && !isOpening && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{
              scale: 1,
              rotate: [0, -3, 3, -3, 0],
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 10,
              rotate: { repeat: Infinity, duration: 2 }
            }}
            className="fixed bottom-24 right-6 z-50"
          >
            <button
              onClick={claimReward}
              className={cn(
                "relative p-6 rounded-2xl bg-gradient-to-br shadow-2xl",
                rarityConfig?.color,
                rarityConfig?.glow
              )}
            >
              {/* Sparkle effects */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [-20, -100],
                      opacity: [0, 1, 0],
                      x: Math.sin(i) * 30
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className="absolute text-white text-sm"
                    style={{ left: `${i * 15 + 10}%`, bottom: 0 }}
                  >
                    ✨
                  </motion.div>
                ))}
              </div>

              <div className="relative text-center">
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-5xl block mb-2"
                >
                  🎁
                </motion.span>
                <p className="text-white font-bold">{t('focusRoom.rewards.reward')}</p>
                <p className="text-white/80 text-sm">{t('focusRoom.rewards.clickToOpen')}</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opening Animation */}
      <AnimatePresence>
        {isOpening && pendingReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0, rotateY: 0 }}
              animate={{
                scale: [0, 1.5, 1],
                rotateY: [0, 180, 360]
              }}
              transition={{ duration: 1.5 }}
              className="text-center"
            >
              {/* Burst effect */}
              <div className="absolute inset-0">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{
                      scale: [0, 3],
                      opacity: [1, 0],
                      x: Math.cos((i * 30 * Math.PI) / 180) * 200,
                      y: Math.sin((i * 30 * Math.PI) / 180) * 200
                    }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={cn(
                      "absolute w-4 h-4 rounded-full top-1/2 left-1/2",
                      `bg-gradient-to-r ${rarityConfig?.color}`
                    )}
                  />
                ))}
              </div>

              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.5, 1] }}
                transition={{ delay: 1, duration: 0.5 }}
                className="text-8xl block mb-4"
              >
                {pendingReward.emoji}
              </motion.span>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                <p className={cn(
                  "text-2xl font-bold mb-2",
                  pendingReward.rarity === 'legendary' ? 'text-yellow-400' :
                  pendingReward.rarity === 'epic' ? 'text-purple-400' :
                  pendingReward.rarity === 'rare' ? 'text-blue-400' : 'text-white'
                )}>
                  {pendingReward.name}
                </p>
                <p className="text-gray-300">{pendingReward.description}</p>
                <p className={cn(
                  "text-sm mt-2 uppercase tracking-wider",
                  pendingReward.rarity === 'legendary' ? 'text-yellow-500' :
                  pendingReward.rarity === 'epic' ? 'text-purple-500' :
                  pendingReward.rarity === 'rare' ? 'text-blue-500' : 'text-gray-500'
                )}>
                  {pendingReward.rarity}
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claimed Rewards Summary */}
      {claimedRewards.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-white">
              {t('focusRoom.rewards.rewardsCount')} ({claimedRewards.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {claimedRewards.slice(-5).map(reward => (
              <span
                key={reward.id}
                className={cn(
                  "text-lg p-1 rounded",
                  `bg-gradient-to-r ${RARITY_CONFIG[reward.rarity].color} bg-opacity-20`
                )}
                title={reward.name}
              >
                {reward.emoji}
              </span>
            ))}
            {claimedRewards.length > 5 && (
              <span className="text-xs text-gray-400 self-center ml-1">
                +{claimedRewards.length - 5}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
