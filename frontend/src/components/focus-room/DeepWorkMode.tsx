'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Play, Square, Bell, BellOff, Clock, Award, AlertCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/contexts/LanguageContext'

interface DeepWorkModeProps {
  roomId: number
  onStart?: () => void
  onEnd?: (completed: boolean) => void
  className?: string
}

interface DeepWorkStatus {
  in_deep_work: boolean
  started_at?: string
  ends_at?: string
  remaining_minutes: number
  sessions_completed: number
  notifications_blocked: boolean
}

export default function DeepWorkMode({ roomId, onStart, onEnd, className }: DeepWorkModeProps) {
  const { toast } = useToast()
  const { t } = useTranslation()

  const DURATION_OPTIONS = [
    { minutes: 30, label: '30 min', description: t('focusRoom.deepWork.duration30Desc') },
    { minutes: 60, label: '1h', description: t('focusRoom.deepWork.duration60Desc') },
    { minutes: 90, label: '90 min', description: t('focusRoom.deepWork.duration90Desc') },
    { minutes: 120, label: '2h', description: t('focusRoom.deepWork.duration120Desc') },
  ]

  const [status, setStatus] = useState<DeepWorkStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDuration, setSelectedDuration] = useState(90)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [showConfirmEnd, setShowConfirmEnd] = useState(false)

  // Charger le statut Deep Work
  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get(`/focus-rooms/${roomId}/deep-work/status`)
      setStatus(response.data)
      if (response.data.in_deep_work) {
        setTimeRemaining(response.data.remaining_minutes * 60)
      }
    } catch (error) {
      console.error('Failed to fetch deep work status:', error)
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Compte a rebours
  useEffect(() => {
    if (!status?.in_deep_work || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Session terminee!
          handleSessionComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [status?.in_deep_work, timeRemaining])

  const handleSessionComplete = async () => {
    try {
      await api.post(`/focus-rooms/${roomId}/deep-work/end`)
      toast({
        title: t('focusRoom.deepWork.completedToast'),
        description: t('focusRoom.deepWork.completedDesc'),
      })
      onEnd?.(true)
      fetchStatus()
    } catch (error) {
      console.error('Failed to complete deep work:', error)
    }
  }

  const startDeepWork = async () => {
    try {
      setLoading(true)
      await api.post(`/focus-rooms/${roomId}/deep-work/start`, {
        duration_minutes: selectedDuration
      })
      toast({
        title: t('focusRoom.deepWork.activatedToast', { minutes: selectedDuration }),
        description: t('focusRoom.deepWork.notifBlockedDesc'),
      })
      onStart?.()
      fetchStatus()
    } catch (error: any) {
      toast({
        title: t('focusRoom.deepWork.errorGeneric'),
        description: error.response?.data?.detail || t('focusRoom.deepWork.startError'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const endDeepWork = async () => {
    try {
      setLoading(true)
      await api.post(`/focus-rooms/${roomId}/deep-work/end`)
      const wasCompleted = timeRemaining <= 0

      if (wasCompleted) {
        toast({
          title: t('focusRoom.deepWork.endedTitle'),
          description: t('focusRoom.deepWork.endedDesc'),
        })
      } else {
        toast({
          title: t('focusRoom.deepWork.interruptedTitle'),
          description: t('focusRoom.deepWork.interruptedDesc'),
        })
      }

      onEnd?.(wasCompleted)
      setShowConfirmEnd(false)
      fetchStatus()
    } catch (error: any) {
      toast({
        title: t('focusRoom.deepWork.errorGeneric'),
        description: error.response?.data?.detail || t('focusRoom.deepWork.errorGeneric'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = status?.in_deep_work && status.ends_at
    ? ((selectedDuration * 60 - timeRemaining) / (selectedDuration * 60)) * 100
    : 0

  if (loading && !status) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  // Mode actif
  if (status?.in_deep_work) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500/30 p-6", className)}>
        {/* Background animation */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent animate-pulse" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 animate-pulse">
                <Brain className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">{t('focusRoom.deepWork.title')}</h3>
                <p className="text-sm text-purple-300">{t('focusRoom.deepWork.maxConcentration')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
              <BellOff className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-300">{t('focusRoom.deepWork.notificationsOff')}</span>
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center py-8">
            {/* Progress Ring */}
            <div className="relative w-48 h-48 mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-purple-900/50"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="text-purple-500"
                  style={{
                    strokeDasharray: 2 * Math.PI * 88,
                    strokeDashoffset: 2 * Math.PI * 88 * (1 - progress / 100),
                    transition: 'stroke-dashoffset 1s linear'
                  }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-mono font-bold text-white">
                  {formatTime(timeRemaining)}
                </span>
                <span className="text-sm text-purple-300 mt-1">{t('focusRoom.deepWork.remaining')}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{Math.round(progress)}%</p>
                <p className="text-xs text-purple-300">{t('focusRoom.deepWork.complete')}</p>
              </div>
              <div className="w-px bg-purple-500/30" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{status.sessions_completed}</p>
                <p className="text-xs text-purple-300">{t('focusRoom.deepWork.sessions')}</p>
              </div>
            </div>
          </div>

          {/* End Button */}
          {!showConfirmEnd ? (
            <button
              onClick={() => setShowConfirmEnd(true)}
              className="w-full py-3 rounded-xl bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white transition flex items-center justify-center gap-2"
            >
              <Square className="h-4 w-4" />
              {t('focusRoom.deepWork.endSession')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmEnd(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 transition"
              >
                {t('focusRoom.deepWork.cancel')}
              </button>
              <button
                onClick={endDeepWork}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 transition flex items-center justify-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                {t('focusRoom.deepWork.confirm')}
              </button>
            </div>
          )}

          {/* Motivation */}
          <p className="text-center text-sm text-purple-300/70 mt-4">
            {t('focusRoom.deepWork.quote')}
          </p>
        </div>
      </div>
    )
  }

  // Mode inactif - Selection de duree
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 p-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-purple-500/20">
          <Brain className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">{t('focusRoom.deepWork.title')}</h3>
          <p className="text-sm text-gray-400">{t('focusRoom.deepWork.subtitle')}</p>
        </div>
      </div>

      {/* Duration Selection */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {DURATION_OPTIONS.map(option => (
          <button
            key={option.minutes}
            onClick={() => setSelectedDuration(option.minutes)}
            className={cn(
              "p-4 rounded-xl border transition-all",
              selectedDuration === option.minutes
                ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                : "bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-lg">{option.label}</span>
              {option.minutes === 90 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/30 text-purple-300">
                  {t('focusRoom.deepWork.recommended')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{option.description}</p>
          </button>
        ))}
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 text-xs text-gray-300">
          <BellOff className="h-3.5 w-3.5" />
          {t('focusRoom.deepWork.featNotifBlocked')}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 text-xs text-gray-300">
          <Award className="h-3.5 w-3.5" />
          {t('focusRoom.deepWork.featXpBonus')}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 text-xs text-gray-300">
          <Sparkles className="h-3.5 w-3.5" />
          {t('focusRoom.deepWork.featAchievement')}
        </div>
      </div>

      {/* Sessions Completed */}
      {status && status.sessions_completed > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <Award className="h-5 w-5 text-green-400" />
          <span className="text-sm text-green-300">
            {status.sessions_completed > 1
              ? t('focusRoom.deepWork.sessionsTodayPlural', { count: status.sessions_completed })
              : t('focusRoom.deepWork.sessionsTodaySingular', { count: status.sessions_completed })}
          </span>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={startDeepWork}
        disabled={loading}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
        ) : (
          <>
            <Play className="h-5 w-5" />
            {t('focusRoom.deepWork.startSession', { minutes: selectedDuration })}
          </>
        )}
      </button>

      {/* Tip */}
      <p className="text-center text-xs text-gray-500 mt-4">
        {t('focusRoom.deepWork.tip')}
      </p>
    </div>
  )
}
