'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Award, Flame } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/LanguageContext'

interface LeaderboardEntry {
  rank: number
  previousRank?: number
  userId: number
  username: string
  avatarUrl?: string
  focusMinutes: number
  isOnline: boolean
  isFocusing: boolean
}

interface LiveLeaderboardProps {
  entries: LeaderboardEntry[]
  currentUserId?: number
  className?: string
}

export default function LiveLeaderboard({ entries, currentUserId, className }: LiveLeaderboardProps) {
  const { t } = useTranslation()
  const [animatedEntries, setAnimatedEntries] = useState(entries)

  useEffect(() => {
    setAnimatedEntries(entries)
  }, [entries])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-400" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-300" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-gray-500">#{rank}</span>
    }
  }

  const getRankChange = (entry: LeaderboardEntry) => {
    if (!entry.previousRank) return null
    const change = entry.previousRank - entry.rank

    if (change > 0) {
      return (
        <div className="flex items-center text-green-500 text-xs">
          <TrendingUp className="h-3 w-3" />
          <span>+{change}</span>
        </div>
      )
    } else if (change < 0) {
      return (
        <div className="flex items-center text-red-500 text-xs">
          <TrendingDown className="h-3 w-3" />
          <span>{change}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center text-gray-500 text-xs">
        <Minus className="h-3 w-3" />
      </div>
    )
  }

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-purple-500/20 border-purple-500/50'
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30'
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30'
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30'
      default:
        return 'bg-gray-800/50 border-gray-700/50'
    }
  }

  return (
    <div className={cn("bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-white">{t('focusRoom.leaderboard.title')}</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          {t('focusRoom.leaderboard.live')}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {animatedEntries.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId
            return (
              <motion.div
                key={entry.userId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{
                  layout: { duration: 0.3 },
                  delay: index * 0.05
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  getRankBg(entry.rank, isCurrentUser),
                  isCurrentUser && "ring-1 ring-purple-500"
                )}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center">
                  {getRankIcon(entry.rank)}
                </div>

                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-10 w-10 border-2 border-gray-700">
                    <AvatarImage src={entry.avatarUrl} />
                    <AvatarFallback className="bg-gray-700 text-white">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {entry.isOnline && (
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900",
                      entry.isFocusing ? "bg-green-500" : "bg-yellow-500"
                    )}>
                      {entry.isFocusing && (
                        <Flame className="h-2 w-2 text-white absolute top-0.5 left-0.5" />
                      )}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "font-medium truncate",
                      isCurrentUser ? "text-purple-300" : "text-white"
                    )}>
                      {entry.username}
                      {isCurrentUser && <span className="text-xs text-purple-400 ml-1">{t('focusRoom.leaderboard.you')}</span>}
                    </p>
                    {entry.isFocusing && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        {t('focusRoom.leaderboard.focus')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {entry.focusMinutes} {t('focusRoom.leaderboard.minToday')}
                  </p>
                </div>

                {/* Rank Change */}
                <div className="flex flex-col items-end">
                  {getRankChange(entry)}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {animatedEntries.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('focusRoom.leaderboard.noParticipants')}</p>
          </div>
        )}
      </div>

      {/* Current User Banner if not in top list */}
      {currentUserId && !animatedEntries.some(e => e.userId === currentUserId) && (
        <div className="p-3 border-t border-gray-700 bg-purple-500/10">
          <p className="text-sm text-center text-purple-300">
            {t('focusRoom.leaderboard.continueToAppear')}
          </p>
        </div>
      )}
    </div>
  )
}
