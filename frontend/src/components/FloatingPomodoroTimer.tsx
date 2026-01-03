'use client'

import { useState, useEffect } from 'react'
import { usePomodoro } from '@/contexts/PomodoroContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Play,
  Pause,
  Square,
  Timer,
  Coffee,
  Target,
  ChevronUp,
  ChevronDown,
  X,
  Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function FloatingPomodoroTimer() {
  const { t } = useLanguage()
  const pathname = usePathname()
  const {
    state,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    formatTime,
    getProgress,
    isActive,
  } = usePomodoro()

  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // Don't show on sessions page (it has its own timer)
  const isSessionsPage = pathname === '/sessions'

  // Auto-expand when session starts
  useEffect(() => {
    if (isActive && !isMinimized) {
      setIsExpanded(true)
      setIsDismissed(false)
    }
  }, [isActive])

  // Don't render if on sessions page, dismissed, or no active session and minimized
  if (isSessionsPage) return null
  if (isDismissed && !isActive) return null
  if (!isActive && isMinimized) return null

  const progress = getProgress()
  const isWork = state.sessionType === 'work'
  const isBreak = state.sessionType !== 'work'

  // Colors based on session type
  const colors = {
    work: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-50 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
      ring: 'ring-red-500',
    },
    short_break: {
      bg: 'bg-blue-500',
      bgLight: 'bg-blue-50 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      ring: 'ring-blue-500',
    },
    long_break: {
      bg: 'bg-green-500',
      bgLight: 'bg-green-50 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      ring: 'ring-green-500',
    },
  }

  const currentColors = colors[state.sessionType]

  // Minimized pill view (just timer)
  if (isMinimized && isActive) {
    return (
      <div
        className={cn(
          'fixed bottom-20 right-6 z-[60]',
          'animate-in slide-in-from-right-5 duration-300'
        )}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
            'bg-white dark:bg-gray-800 border-2',
            currentColors.border,
            'hover:scale-105 transition-transform cursor-pointer'
          )}
        >
          {isWork ? (
            <Target className={cn('h-4 w-4', currentColors.text)} />
          ) : (
            <Coffee className={cn('h-4 w-4', currentColors.text)} />
          )}
          <span className={cn('font-bold font-mono text-lg', currentColors.text)}>
            {formatTime(state.timeLeft)}
          </span>
          {state.isPaused && (
            <span className="text-xs text-orange-500 font-medium">PAUSE</span>
          )}
          <ChevronUp className="h-4 w-4 text-gray-400" />
        </button>

        {/* Progress ring behind */}
        <svg
          className="absolute inset-0 -z-10 w-full h-full pointer-events-none"
          style={{ transform: 'scale(1.3)' }}
        >
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className={cn('opacity-20', currentColors.text)}
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 45} ${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className={currentColors.text}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
          />
        </svg>
      </div>
    )
  }

  // Expanded view
  return (
    <div
      className={cn(
        'fixed bottom-20 right-6 z-[60]',
        'w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl',
        'border-2',
        currentColors.border,
        'animate-in slide-in-from-right-5 duration-300'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 rounded-t-xl', currentColors.bgLight)}>
        <div className="flex items-center gap-2">
          <Timer className={cn('h-5 w-5', currentColors.text)} />
          <span className={cn('font-semibold', currentColors.text)}>
            {isWork ? 'Pomodoro' : state.sessionType === 'short_break' ? 'Pause courte' : 'Pause longue'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition"
              title="Minimiser"
            >
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <Link
            href="/sessions"
            className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition"
            title="Ouvrir Sessions"
          >
            <Maximize2 className="h-4 w-4 text-gray-500" />
          </Link>
          {!isActive && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded transition"
              title="Fermer"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Timer Display */}
      <div className="p-4">
        {/* Subject */}
        {state.subject && isActive && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-2 truncate">
            {state.subject}
          </p>
        )}

        {/* Circular Progress */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className={currentColors.text}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-3xl font-bold font-mono', currentColors.text)}>
              {formatTime(state.timeLeft)}
            </span>
            {state.isPaused && (
              <span className="text-xs text-orange-500 font-medium mt-1">EN PAUSE</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isActive ? (
            // Start button
            <button
              onClick={() => startSession()}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition',
                currentColors.bg,
                'hover:opacity-90'
              )}
            >
              <Play className="h-5 w-5" />
              Démarrer
            </button>
          ) : (
            <>
              {/* Pause/Resume */}
              {state.isPaused ? (
                <button
                  onClick={resumeSession}
                  className={cn(
                    'p-3 rounded-full text-white transition',
                    currentColors.bg,
                    'hover:opacity-90'
                  )}
                  title="Reprendre"
                >
                  <Play className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={pauseSession}
                  className="p-3 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition"
                  title="Pause"
                >
                  <Pause className="h-5 w-5" />
                </button>
              )}

              {/* Stop */}
              <button
                onClick={stopSession}
                className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                title="Arrêter"
              >
                <Square className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {state.completedPomodoros}
            </div>
            <div className="text-xs text-gray-500">Pomodoros</div>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.floor(state.totalMinutesToday / 60)}h{state.totalMinutesToday % 60}m
            </div>
            <div className="text-xs text-gray-500">Aujourd'hui</div>
          </div>
        </div>
      </div>
    </div>
  )
}
