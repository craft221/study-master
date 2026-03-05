'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService, generateTempId, isTempId } from '@/services/syncService'

// Types
export type SessionType = 'work' | 'short_break' | 'long_break'

interface PomodoroState {
  sessionType: SessionType
  timeLeft: number
  isRunning: boolean
  isPaused: boolean
  subject: string
  sessionId: string | null
  completedPomodoros: number
  totalMinutesToday: number
  startedAt: number | null // timestamp when session started
  startedFromSessionsPage: boolean // track if session was started from sessions page
}

interface PomodoroContextType {
  // State
  state: PomodoroState
  // Actions
  startSession: (subject?: string, fromSessionsPage?: boolean) => Promise<void>
  pauseSession: () => void
  resumeSession: () => void
  resetSession: () => void
  stopSession: () => Promise<void>
  setSessionType: (type: SessionType) => void
  setSubject: (subject: string) => void
  setStartedFromSessionsPage: (value: boolean) => void
  // Helpers
  formatTime: (seconds: number) => string
  getProgress: () => number
  isActive: boolean
  durations: Record<SessionType, number>
}

const DURATIONS: Record<SessionType, number> = {
  work: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
}

const STORAGE_KEY = 'pomodoro_session'

// Sound URLs
const SOUND_URLS = {
  complete: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  start: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
}

const defaultState: PomodoroState = {
  sessionType: 'work',
  timeLeft: DURATIONS.work,
  isRunning: false,
  isPaused: false,
  subject: '',
  sessionId: null,
  completedPomodoros: 0,
  totalMinutesToday: 0,
  startedAt: null,
  startedFromSessionsPage: false,
}

const PomodoroContext = createContext<PomodoroContextType | null>(null)

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PomodoroState>(defaultState)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const stateRef = useRef<PomodoroState>(defaultState)

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.volume = 0.5
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Play sound
  const playSound = useCallback((type: 'complete' | 'start') => {
    if (!audioRef.current) return
    try {
      audioRef.current.src = SOUND_URLS[type]
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {
      // Ignore audio errors
    }
  }, [])

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PomodoroState
        // Calculate elapsed time if session was running
        if (parsed.isRunning && parsed.startedAt) {
          const elapsed = Math.floor((Date.now() - parsed.startedAt) / 1000)
          const newTimeLeft = Math.max(0, parsed.timeLeft - elapsed)

          if (newTimeLeft > 0) {
            setState({
              ...parsed,
              timeLeft: newTimeLeft,
              startedAt: Date.now() - (parsed.timeLeft - newTimeLeft) * 1000
            })
          } else {
            // Session expired while away
            setState({
              ...defaultState,
              completedPomodoros: parsed.completedPomodoros,
              totalMinutesToday: parsed.totalMinutesToday,
            })
          }
        } else {
          setState(parsed)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    // Fetch today's stats
    fetchTodayStats()
  }, [])

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Timer countdown
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.timeLeft <= 1) {
            handleSessionComplete()
            return prev
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 }
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state.isRunning, state.isPaused])

  // Fetch today's stats
  const fetchTodayStats = async () => {
    try {
      if (isOnline) {
        const response = await api.get('/study-sessions/stats?days=1')
        if (response.data) {
          setState(prev => ({
            ...prev,
            completedPomodoros: response.data.total_sessions || 0,
            totalMinutesToday: response.data.total_minutes || 0,
          }))
          // Save to cache for offline use
          await offlineStorage.saveGamificationData('pomodoro_stats', {
            total_sessions: response.data.total_sessions || 0,
            total_minutes: response.data.total_minutes || 0,
            cached_at: new Date().toISOString(),
          })
        }
      } else {
        // Offline: load from cache
        const cachedStats = await offlineStorage.getTodayStudyStats()
        setState(prev => ({
          ...prev,
          completedPomodoros: cachedStats.total_sessions || 0,
          totalMinutesToday: cachedStats.total_minutes || 0,
        }))
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Fallback to cache on error
      try {
        const cachedStats = await offlineStorage.getTodayStudyStats()
        setState(prev => ({
          ...prev,
          completedPomodoros: cachedStats.total_sessions || 0,
          totalMinutesToday: cachedStats.total_minutes || 0,
        }))
      } catch (cacheError) {
        console.error('Error loading cached stats:', cacheError)
      }
    }
  }

  // Handle session complete
  const handleSessionComplete = useCallback(async () => {
    playSound('complete')

    setState(prev => {
      const isWork = prev.sessionType === 'work'
      const newCompleted = isWork ? prev.completedPomodoros + 1 : prev.completedPomodoros

      // Determine next session type
      let nextType: SessionType = 'work'
      let nextTime = DURATIONS.work

      if (isWork) {
        if ((newCompleted) % 4 === 0) {
          nextType = 'long_break'
          nextTime = DURATIONS.long_break
        } else {
          nextType = 'short_break'
          nextTime = DURATIONS.short_break
        }
      }

      toast.success(
        isWork
          ? `Pomodoro terminé ! Pause ${nextType === 'long_break' ? 'longue' : 'courte'} méritée.`
          : 'Pause terminée ! Prêt pour un nouveau Pomodoro ?'
      )

      return {
        ...prev,
        sessionType: nextType,
        timeLeft: nextTime,
        isRunning: false,
        isPaused: false,
        startedAt: null,
        completedPomodoros: newCompleted,
        totalMinutesToday: isWork ? prev.totalMinutesToday + 25 : prev.totalMinutesToday,
      }
    })

    // Save to API if work session — use stateRef to avoid stale closure
    const currentState = stateRef.current
    if (currentState.sessionType === 'work' && currentState.sessionId) {
      const sessionData = {
        actual_duration_minutes: 25,
        productivity_rating: 4,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }

      if (isOnline && !isTempId(currentState.sessionId)) {
        try {
          await api.put(`/study-sessions/${currentState.sessionId}/complete`, sessionData)
        } catch (error) {
          console.error('Error saving session:', error)
          // Save to IndexedDB on error
          await offlineStorage.saveStudySession({
            id: currentState.sessionId,
            ...sessionData,
            subject_name: currentState.subject,
          })
        }
      } else {
        // Offline: update in IndexedDB and queue for sync
        const offlineSession = {
          id: currentState.sessionId,
          ...sessionData,
          subject_name: currentState.subject,
          _isOffline: true,
        }
        await offlineStorage.saveStudySession(offlineSession)

        // Queue for sync when back online
        if (isTempId(currentState.sessionId)) {
          await syncService.queueAction(
            STORES.STUDY_SESSIONS,
            'update',
            `/study-sessions/${currentState.sessionId}/complete`,
            'PUT',
            sessionData
          )
        }
      }
    }
  }, [isOnline, playSound])

  // Start session
  const startSession = useCallback(async (subject?: string, fromSessionsPage?: boolean) => {
    const subjectToUse = subject || state.subject || 'Session générale'

    // Create session in API for work sessions
    let sessionId = state.sessionId
    if (state.sessionType === 'work' && !sessionId) {
      const sessionData = {
        subject_name: subjectToUse,
        session_type: 'pomodoro',
        planned_duration_minutes: 25,
        started_at: new Date().toISOString(),
        status: 'in_progress',
      }

      if (isOnline) {
        try {
          const response = await api.post('/study-sessions/', sessionData)
          sessionId = response.data.id
          // Save to cache
          await offlineStorage.saveStudySession({
            id: sessionId,
            ...sessionData,
            created_at: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Error starting session:', error)
          // Fallback to offline mode
          sessionId = generateTempId()
          const offlineSession = {
            id: sessionId,
            _tempId: sessionId,
            ...sessionData,
            created_at: new Date().toISOString(),
            _isOffline: true,
          }
          await offlineStorage.saveStudySession(offlineSession)
          await syncService.queueAction(
            STORES.STUDY_SESSIONS,
            'create',
            '/study-sessions/',
            'POST',
            { ...sessionData, _tempId: sessionId }
          )
        }
      } else {
        // Offline: create with temp ID
        sessionId = generateTempId()
        const offlineSession = {
          id: sessionId,
          _tempId: sessionId,
          ...sessionData,
          created_at: new Date().toISOString(),
          _isOffline: true,
        }
        await offlineStorage.saveStudySession(offlineSession)
        await syncService.queueAction(
          STORES.STUDY_SESSIONS,
          'create',
          '/study-sessions/',
          'POST',
          { ...sessionData, _tempId: sessionId }
        )
      }
    }

    playSound('start')

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
      subject: subjectToUse,
      sessionId,
      startedFromSessionsPage: fromSessionsPage || false,
    }))
  }, [state.subject, state.sessionType, state.sessionId, isOnline, playSound])

  // Pause session
  const pauseSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: true,
    }))
  }, [])

  // Resume session
  const resumeSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
      startedAt: Date.now(),
    }))
  }, [])

  // Reset session
  const resetSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      timeLeft: DURATIONS[prev.sessionType],
      isRunning: false,
      isPaused: false,
      startedAt: null,
      sessionId: null,
    }))
  }, [])

  // Stop session completely
  const stopSession = useCallback(async () => {
    // Save partial progress if work session
    if (state.sessionType === 'work' && state.sessionId) {
      const elapsedMinutes = Math.floor((DURATIONS.work - state.timeLeft) / 60)
      if (elapsedMinutes > 0) {
        const sessionData = {
          actual_duration_minutes: elapsedMinutes,
          productivity_rating: 3,
          status: 'stopped',
          completed_at: new Date().toISOString(),
        }

        if (isOnline && !isTempId(state.sessionId)) {
          try {
            await api.put(`/study-sessions/${state.sessionId}/complete`, sessionData)
          } catch (error) {
            console.error('Error saving session:', error)
            // Save to IndexedDB on error
            await offlineStorage.saveStudySession({
              id: state.sessionId,
              ...sessionData,
              subject_name: state.subject,
            })
          }
        } else {
          // Offline: update in IndexedDB and queue for sync
          const offlineSession = {
            id: state.sessionId,
            ...sessionData,
            subject_name: state.subject,
            _isOffline: true,
          }
          await offlineStorage.saveStudySession(offlineSession)

          if (isTempId(state.sessionId)) {
            await syncService.queueAction(
              STORES.STUDY_SESSIONS,
              'update',
              `/study-sessions/${state.sessionId}/complete`,
              'PUT',
              sessionData
            )
          }
        }
      }
    }

    setState(prev => ({
      ...prev,
      sessionType: 'work',
      timeLeft: DURATIONS.work,
      isRunning: false,
      isPaused: false,
      startedAt: null,
      sessionId: null,
      subject: '',
      startedFromSessionsPage: false,
    }))
  }, [state.sessionType, state.sessionId, state.timeLeft, state.subject, isOnline])

  // Set session type
  const setSessionType = useCallback((type: SessionType) => {
    if (!state.isRunning) {
      setState(prev => ({
        ...prev,
        sessionType: type,
        timeLeft: DURATIONS[type],
      }))
    }
  }, [state.isRunning])

  // Set subject
  const setSubject = useCallback((subject: string) => {
    setState(prev => ({ ...prev, subject }))
  }, [])

  // Set startedFromSessionsPage
  const setStartedFromSessionsPage = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, startedFromSessionsPage: value }))
  }, [])

  // Format time helper
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Get progress percentage
  const getProgress = useCallback(() => {
    const total = DURATIONS[state.sessionType]
    return ((total - state.timeLeft) / total) * 100
  }, [state.sessionType, state.timeLeft])

  const value: PomodoroContextType = {
    state,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    stopSession,
    setSessionType,
    setSubject,
    setStartedFromSessionsPage,
    formatTime,
    getProgress,
    isActive: state.isRunning,
    durations: DURATIONS,
  }

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  )
}

export function usePomodoro() {
  const context = useContext(PomodoroContext)
  if (!context) {
    throw new Error('usePomodoro must be used within a PomodoroProvider')
  }
  return context
}

export default PomodoroContext
