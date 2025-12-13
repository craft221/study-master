'use client'

import { useState, useEffect } from 'react'
import { Eye, Users, TrendingUp, Zap, AlertCircle, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/contexts/LanguageContext'

interface SocialPressureProps {
  viewerCount: number
  focusingCount: number
  myFocusMinutes: number
  roomAverage: number
  myRank?: number
  totalParticipants: number
  className?: string
}

export default function SocialPressure({
  viewerCount,
  focusingCount,
  myFocusMinutes,
  roomAverage,
  myRank,
  totalParticipants,
  className
}: SocialPressureProps) {
  const { t } = useTranslation()
  const [pulseWatching, setPulseWatching] = useState(false)
  const [showEncouragement, setShowEncouragement] = useState(false)

  // Pulse effect when viewer count changes
  useEffect(() => {
    setPulseWatching(true)
    const timer = setTimeout(() => setPulseWatching(false), 1000)
    return () => clearTimeout(timer)
  }, [viewerCount])

  // Show encouragement when falling behind
  useEffect(() => {
    if (myFocusMinutes < roomAverage * 0.7 && roomAverage > 0) {
      setShowEncouragement(true)
      const timer = setTimeout(() => setShowEncouragement(false), 10000)
      return () => clearTimeout(timer)
    }
  }, [myFocusMinutes, roomAverage])

  const performanceStatus = () => {
    if (roomAverage === 0) return { label: t('focusRoom.socialPressure.new'), color: 'text-gray-400', bg: 'bg-gray-500/20' }
    const ratio = myFocusMinutes / roomAverage
    if (ratio >= 1.5) return { label: t('focusRoom.socialPressure.dominant'), color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: '👑' }
    if (ratio >= 1.2) return { label: t('focusRoom.socialPressure.aboveAverage'), color: 'text-green-400', bg: 'bg-green-500/20', icon: '🔥' }
    if (ratio >= 0.8) return { label: t('focusRoom.socialPressure.onAverage'), color: 'text-blue-400', bg: 'bg-blue-500/20', icon: '💪' }
    if (ratio >= 0.5) return { label: t('focusRoom.socialPressure.behind'), color: 'text-orange-400', bg: 'bg-orange-500/20', icon: '⚡' }
    return { label: t('focusRoom.socialPressure.catchUp'), color: 'text-red-400', bg: 'bg-red-500/20', icon: '🚀' }
  }

  const status = performanceStatus()

  return (
    <div className={cn("space-y-3", className)}>
      {/* Viewers Banner - "X personnes te regardent" */}
      <motion.div
        animate={pulseWatching ? { scale: [1, 1.02, 1] } : {}}
        className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Eye className="h-6 w-6 text-purple-400" />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-purple-500/30"
              />
            </div>
            <div>
              <p className="text-lg font-bold text-white">
                {viewerCount > 1
                  ? t('focusRoom.socialPressure.watchingYouPlural', { count: viewerCount })
                  : t('focusRoom.socialPressure.watchingYou', { count: viewerCount })}
              </p>
              <p className="text-xs text-purple-300">{t('focusRoom.socialPressure.dontDisappoint')}</p>
            </div>
          </div>
          <div className="text-3xl">👀</div>
        </div>
      </motion.div>

      {/* Focus Status Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Currently Focusing */}
        <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">{t('focusRoom.socialPressure.inFocus')}</span>
          </div>
          <p className="text-2xl font-bold text-white">{focusingCount}</p>
          <p className="text-xs text-gray-500">{t('focusRoom.socialPressure.of')} {totalParticipants}</p>
        </div>

        {/* My Rank */}
        {myRank && (
          <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-gray-400">{t('focusRoom.socialPressure.yourRank')}</span>
            </div>
            <p className="text-2xl font-bold text-white">#{myRank}</p>
            <p className="text-xs text-gray-500">{t('focusRoom.socialPressure.of')} {totalParticipants}</p>
          </div>
        )}
      </div>

      {/* Performance Comparison */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-400">{t('focusRoom.socialPressure.vsGroupAverage')}</span>
          <span className={cn("text-xs px-2 py-1 rounded-full", status.bg, status.color)}>
            {status.icon} {status.label}
          </span>
        </div>

        {/* Comparison Bar */}
        <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden">
          {/* Room Average Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
            style={{ left: '50%' }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
              {t('focusRoom.socialPressure.average')}: {roomAverage}{t('focusRoom.socialPressure.min')}
            </span>
          </div>

          {/* My Progress */}
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min((myFocusMinutes / (roomAverage * 2)) * 100, 100)}%`
            }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          />

          {/* My Position Indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-xs font-bold"
            style={{
              left: `${Math.min((myFocusMinutes / (roomAverage * 2)) * 100, 95)}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {myFocusMinutes}
          </div>
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0 {t('focusRoom.socialPressure.min')}</span>
          <span>{roomAverage * 2} {t('focusRoom.socialPressure.min')}</span>
        </div>
      </div>

      {/* Encouragement/Pressure Message */}
      <AnimatePresence>
        {showEncouragement && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-300">
                  {t('focusRoom.socialPressure.belowAverage')}
                </p>
                <p className="text-sm text-orange-200/70 mt-1">
                  {t('focusRoom.socialPressure.peopleWorking', { count: focusingCount })}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak Warning */}
      {myFocusMinutes > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
          <Clock className="h-3 w-3" />
          <span>
            {t('focusRoom.socialPressure.streakWarning', { minutes: myFocusMinutes })}
          </span>
        </div>
      )}
    </div>
  )
}
