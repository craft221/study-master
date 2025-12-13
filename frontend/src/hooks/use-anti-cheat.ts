/**
 * Hook Anti-Triche
 * Surveille les comportements suspects côté client
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import antiCheatService, { ViolationResponse, ValidateQuizResponse } from '@/services/anti-cheat'

interface UseAntiCheatOptions {
  quizId: number
  duelId?: number
  onViolation?: (violation: ViolationResponse) => void
  onWarning?: (message: string) => void
  enabled?: boolean
}

interface UseAntiCheatReturn {
  sessionId: string | null
  isActive: boolean
  violations: ViolationResponse[]
  tabSwitchCount: number
  focusLossCount: number
  startSession: () => Promise<void>
  recordAnswer: (questionId: number, answerId: number, timeTakenMs: number, questionIndex: number) => Promise<void>
  validateAndEnd: (totalQuestions: number, score: number, totalTimeSeconds: number) => Promise<ValidateQuizResponse | null>
}

export function useAntiCheat(options: UseAntiCheatOptions): UseAntiCheatReturn {
  const { quizId, duelId, onViolation, onWarning, enabled = true } = options

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [violations, setViolations] = useState<ViolationResponse[]>([])
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [focusLossCount, setFocusLossCount] = useState(0)

  const sessionIdRef = useRef<string | null>(null)

  // Démarrer une session
  const startSession = useCallback(async () => {
    if (!enabled) return

    try {
      const response = await antiCheatService.startSession(quizId, duelId)
      setSessionId(response.session_id)
      sessionIdRef.current = response.session_id
      setIsActive(true)
      setViolations([])
      setTabSwitchCount(0)
      setFocusLossCount(0)
    } catch (error) {
      console.error('Failed to start anti-cheat session:', error)
    }
  }, [quizId, duelId, enabled])

  // Enregistrer une réponse
  const recordAnswer = useCallback(async (
    questionId: number,
    answerId: number,
    timeTakenMs: number,
    questionIndex: number
  ) => {
    if (!sessionIdRef.current || !enabled) return

    try {
      const violation = await antiCheatService.recordAnswer(
        sessionIdRef.current,
        questionId,
        answerId,
        timeTakenMs,
        questionIndex
      )

      if (violation) {
        setViolations(prev => [...prev, violation])
        onViolation?.(violation)
      }
    } catch (error) {
      console.error('Failed to record answer:', error)
    }
  }, [enabled, onViolation])

  // Enregistrer un événement
  const recordEvent = useCallback(async (eventType: string, details?: Record<string, any>) => {
    if (!sessionIdRef.current || !enabled) return

    try {
      const violation = await antiCheatService.recordEvent(
        sessionIdRef.current,
        eventType,
        details
      )

      if (violation) {
        setViolations(prev => [...prev, violation])
        onViolation?.(violation)
      }
    } catch (error) {
      console.error('Failed to record event:', error)
    }
  }, [enabled, onViolation])

  // Valider et terminer
  const validateAndEnd = useCallback(async (
    totalQuestions: number,
    score: number,
    totalTimeSeconds: number
  ): Promise<ValidateQuizResponse | null> => {
    if (!sessionIdRef.current || !enabled) return null

    try {
      const result = await antiCheatService.validateQuiz(
        sessionIdRef.current,
        totalQuestions,
        score,
        totalTimeSeconds
      )

      setIsActive(false)
      setSessionId(null)
      sessionIdRef.current = null

      if (result.warning_message) {
        onWarning?.(result.warning_message)
      }

      return result
    } catch (error) {
      console.error('Failed to validate quiz:', error)
      return null
    }
  }, [enabled, onWarning])

  // Surveillance des événements du navigateur
  useEffect(() => {
    if (!isActive || !enabled) return

    // Détection de changement d'onglet
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1
          recordEvent('tab_switch', { count: newCount })
          return newCount
        })
      }
    }

    // Détection de perte de focus
    const handleBlur = () => {
      setFocusLossCount(prev => {
        const newCount = prev + 1
        recordEvent('window_blur', { count: newCount })
        return newCount
      })
    }

    // Détection de copier-coller
    const handleCopy = (e: ClipboardEvent) => {
      recordEvent('copy_paste', { action: 'copy' })
    }

    const handlePaste = (e: ClipboardEvent) => {
      recordEvent('copy_paste', { action: 'paste' })
    }

    // Détection de clic droit (tentative d'inspection)
    const handleContextMenu = (e: MouseEvent) => {
      recordEvent('context_menu', {})
    }

    // Détection de raccourcis clavier suspects
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C, Ctrl+V, Ctrl+Shift+I (DevTools), F12
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        recordEvent('suspicious_keypress', { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey })
      }
    }

    // Ajouter les listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    // Nettoyage
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, enabled, recordEvent])

  return {
    sessionId,
    isActive,
    violations,
    tabSwitchCount,
    focusLossCount,
    startSession,
    recordAnswer,
    validateAndEnd
  }
}

export default useAntiCheat
