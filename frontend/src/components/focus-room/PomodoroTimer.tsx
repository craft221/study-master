'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, RotateCcw, Settings, Coffee, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/contexts/LanguageContext'

interface PomodoroTimerProps {
  onStatusChange?: (status: 'focusing' | 'break') => void
  onComplete?: (type: 'focus' | 'break') => void
  className?: string
}

interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsUntilLongBreak: number
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4
}

export default function PomodoroTimer({ onStatusChange, onComplete, className }: PomodoroTimerProps) {
  const { t } = useTranslation()
  const [settings] = useState<PomodoroSettings>(DEFAULT_SETTINGS)
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus')
  const [timeLeft, setTimeLeft] = useState(settings.focusMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [totalFocusTime, setTotalFocusTime] = useState(0)

  const getModeTime = useCallback((m: typeof mode) => {
    switch (m) {
      case 'focus': return settings.focusMinutes * 60
      case 'shortBreak': return settings.shortBreakMinutes * 60
      case 'longBreak': return settings.longBreakMinutes * 60
    }
  }, [settings])

  const getModeConfig = (m: typeof mode) => {
    switch (m) {
      case 'focus':
        return {
          label: t('pomodoro.focus'),
          icon: <Brain className="h-6 w-6" />,
          color: 'from-green-500 to-emerald-600',
          bgColor: 'bg-green-500/20',
          textColor: 'text-green-400',
          ringColor: 'stroke-green-500'
        }
      case 'shortBreak':
        return {
          label: t('pomodoro.shortBreak'),
          icon: <Coffee className="h-6 w-6" />,
          color: 'from-yellow-500 to-amber-600',
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
          ringColor: 'stroke-yellow-500'
        }
      case 'longBreak':
        return {
          label: t('pomodoro.longBreak'),
          icon: <Coffee className="h-6 w-6" />,
          color: 'from-blue-500 to-cyan-600',
          bgColor: 'bg-blue-500/20',
          textColor: 'text-blue-400',
          ringColor: 'stroke-blue-500'
        }
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1)
        if (mode === 'focus') {
          setTotalFocusTime(prev => prev + 1)
        }
      }, 1000)
    } else if (timeLeft === 0) {
      // Timer complete
      handleTimerComplete()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeLeft, mode])

  const handleTimerComplete = () => {
    setIsRunning(false)

    // Play notification sound
    const audio = new Audio('/sounds/bell.mp3')
    audio.play().catch(() => {})

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200])
    }

    if (mode === 'focus') {
      const newSessions = sessionsCompleted + 1
      setSessionsCompleted(newSessions)
      onComplete?.('focus')

      // Determine break type
      if (newSessions % settings.sessionsUntilLongBreak === 0) {
        setMode('longBreak')
        setTimeLeft(settings.longBreakMinutes * 60)
        onStatusChange?.('break')
      } else {
        setMode('shortBreak')
        setTimeLeft(settings.shortBreakMinutes * 60)
        onStatusChange?.('break')
      }
    } else {
      // Break complete, back to focus
      setMode('focus')
      setTimeLeft(settings.focusMinutes * 60)
      onComplete?.('break')
      onStatusChange?.('focusing')
    }
  }

  const toggleTimer = () => {
    if (!isRunning && mode === 'focus') {
      onStatusChange?.('focusing')
    } else if (!isRunning && mode !== 'focus') {
      onStatusChange?.('break')
    }
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(getModeTime(mode))
  }

  const switchMode = (newMode: typeof mode) => {
    setIsRunning(false)
    setMode(newMode)
    setTimeLeft(getModeTime(newMode))
    onStatusChange?.(newMode === 'focus' ? 'focusing' : 'break')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const config = getModeConfig(mode)
  const progress = ((getModeTime(mode) - timeLeft) / getModeTime(mode)) * 100
  const circumference = 2 * Math.PI * 120 // radius = 120

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-8 bg-gray-800/50 p-1 rounded-xl">
        {(['focus', 'shortBreak', 'longBreak'] as const).map(m => {
          const mConfig = getModeConfig(m)
          return (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                mode === m
                  ? `bg-gradient-to-r ${mConfig.color} text-white shadow-lg`
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              )}
            >
              {mConfig.label}
            </button>
          )
        })}
      </div>

      {/* Circular Timer */}
      <div className="relative w-72 h-72 mb-8">
        {/* Background Ring */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="144"
            cy="144"
            r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-700"
          />
          {/* Progress Ring */}
          <circle
            cx="144"
            cy="144"
            r="120"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={config.ringColor}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: circumference - (progress / 100) * circumference,
              transition: 'stroke-dashoffset 1s linear'
            }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn("p-3 rounded-full mb-2", config.bgColor)}>
            {config.icon}
          </div>
          <span className={cn("text-sm font-medium mb-1", config.textColor)}>
            {config.label}
          </span>
          <span className="text-6xl font-mono font-bold text-white tracking-wider">
            {formatTime(timeLeft)}
          </span>
          <span className="text-sm text-gray-400 mt-2">
            Session {sessionsCompleted + 1}
          </span>
        </div>

        {/* Pulsing effect when running */}
        {isRunning && (
          <div className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-20",
            `bg-gradient-to-r ${config.color}`
          )} style={{ animationDuration: '2s' }} />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={resetTimer}
          className="p-3 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        <button
          onClick={toggleTimer}
          className={cn(
            "p-6 rounded-2xl text-white shadow-2xl transition-all transform hover:scale-105",
            `bg-gradient-to-r ${config.color}`,
            isRunning && "animate-pulse"
          )}
        >
          {isRunning ? (
            <Pause className="h-8 w-8" />
          ) : (
            <Play className="h-8 w-8 ml-1" />
          )}
        </button>

        <button
          className="p-3 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Session Stats */}
      <div className="flex gap-6 mt-8 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{sessionsCompleted}</p>
          <p className="text-xs text-gray-400">{t('pomodoro.sessions')}</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div>
          <p className="text-2xl font-bold text-white">{Math.floor(totalFocusTime / 60)}</p>
          <p className="text-xs text-gray-400">{t('pomodoro.focusMinutes')}</p>
        </div>
        <div className="w-px bg-gray-700" />
        <div>
          <p className="text-2xl font-bold text-white">
            {sessionsCompleted > 0 ? Math.round((totalFocusTime / 60) / sessionsCompleted) : 0}
          </p>
          <p className="text-xs text-gray-400">{t('pomodoro.avgPerSession')}</p>
        </div>
      </div>
    </div>
  )
}
