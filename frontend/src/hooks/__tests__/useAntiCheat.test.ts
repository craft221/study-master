/**
 * Tests for useAntiCheat hook
 */
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock anti-cheat service
const mockStartSession = jest.fn()
const mockRecordAnswer = jest.fn()
const mockRecordEvent = jest.fn()
const mockValidateQuiz = jest.fn()

jest.mock('@/services/anti-cheat', () => ({
  __esModule: true,
  default: {
    startSession: (...args: any[]) => mockStartSession(...args),
    recordAnswer: (...args: any[]) => mockRecordAnswer(...args),
    recordEvent: (...args: any[]) => mockRecordEvent(...args),
    validateQuiz: (...args: any[]) => mockValidateQuiz(...args),
  },
}))

import { useAntiCheat } from '../use-anti-cheat'

describe('useAntiCheat Hook', () => {
  const defaultOptions = {
    quizId: 1,
    enabled: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockStartSession.mockResolvedValue({ session_id: 'test-session-123' })
    mockRecordAnswer.mockResolvedValue(null)
    mockRecordEvent.mockResolvedValue(null)
    mockValidateQuiz.mockResolvedValue({
      is_valid: true,
      is_disqualified: false,
      penalty_xp: 0,
      violations: [],
    })

    // Mock document events
    jest.spyOn(document, 'addEventListener')
    jest.spyOn(document, 'removeEventListener')
    jest.spyOn(window, 'addEventListener')
    jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('initializes with correct default values', () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      expect(result.current.sessionId).toBeNull()
      expect(result.current.isActive).toBe(false)
      expect(result.current.violations).toEqual([])
      expect(result.current.tabSwitchCount).toBe(0)
      expect(result.current.focusLossCount).toBe(0)
    })

    it('provides required functions', () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      expect(typeof result.current.startSession).toBe('function')
      expect(typeof result.current.recordAnswer).toBe('function')
      expect(typeof result.current.validateAndEnd).toBe('function')
    })
  })

  describe('Start Session', () => {
    it('starts a session successfully', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      expect(mockStartSession).toHaveBeenCalledWith(1, undefined)
      expect(result.current.sessionId).toBe('test-session-123')
      expect(result.current.isActive).toBe(true)
    })

    it('starts session with duelId', async () => {
      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, duelId: 42 })
      )

      await act(async () => {
        await result.current.startSession()
      })

      expect(mockStartSession).toHaveBeenCalledWith(1, 42)
    })

    it('does not start session when disabled', async () => {
      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, enabled: false })
      )

      await act(async () => {
        await result.current.startSession()
      })

      expect(mockStartSession).not.toHaveBeenCalled()
      expect(result.current.sessionId).toBeNull()
    })

    it('resets state on new session', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      // Simulate some state
      await act(async () => {
        await result.current.startSession()
      })

      expect(result.current.violations).toEqual([])
      expect(result.current.tabSwitchCount).toBe(0)
      expect(result.current.focusLossCount).toBe(0)
    })

    it('handles start session error gracefully', async () => {
      mockStartSession.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      expect(result.current.sessionId).toBeNull()
      expect(result.current.isActive).toBe(false)
    })
  })

  describe('Record Answer', () => {
    it('records answer successfully', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      await act(async () => {
        await result.current.recordAnswer(0, 1, 5000, 0)
      })

      expect(mockRecordAnswer).toHaveBeenCalledWith(
        'test-session-123',
        0,
        1,
        5000,
        0
      )
    })

    it('does not record answer without active session', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.recordAnswer(0, 1, 5000, 0)
      })

      expect(mockRecordAnswer).not.toHaveBeenCalled()
    })

    it('does not record answer when disabled', async () => {
      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, enabled: false })
      )

      await act(async () => {
        await result.current.recordAnswer(0, 1, 5000, 0)
      })

      expect(mockRecordAnswer).not.toHaveBeenCalled()
    })

    it('adds violation when answer returns one', async () => {
      const violation = {
        type: 'too_fast_answer',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }
      mockRecordAnswer.mockResolvedValue(violation)

      const onViolation = jest.fn()
      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, onViolation })
      )

      await act(async () => {
        await result.current.startSession()
      })

      await act(async () => {
        await result.current.recordAnswer(0, 1, 100, 0) // Too fast
      })

      expect(result.current.violations).toContainEqual(violation)
      expect(onViolation).toHaveBeenCalledWith(violation)
    })
  })

  describe('Validate and End', () => {
    it('validates quiz successfully', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      let validationResult: any
      await act(async () => {
        validationResult = await result.current.validateAndEnd(10, 80, 300)
      })

      expect(mockValidateQuiz).toHaveBeenCalledWith('test-session-123', 10, 80, 300)
      expect(validationResult).toEqual({
        is_valid: true,
        is_disqualified: false,
        penalty_xp: 0,
        violations: [],
      })
    })

    it('clears session after validation', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      expect(result.current.isActive).toBe(true)

      await act(async () => {
        await result.current.validateAndEnd(10, 80, 300)
      })

      expect(result.current.isActive).toBe(false)
      expect(result.current.sessionId).toBeNull()
    })

    it('calls onWarning callback', async () => {
      const onWarning = jest.fn()
      mockValidateQuiz.mockResolvedValue({
        is_valid: true,
        warning_message: 'Suspicious behavior detected',
      })

      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, onWarning })
      )

      await act(async () => {
        await result.current.startSession()
      })

      await act(async () => {
        await result.current.validateAndEnd(10, 80, 300)
      })

      expect(onWarning).toHaveBeenCalledWith('Suspicious behavior detected')
    })

    it('returns null without active session', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      let validationResult: any
      await act(async () => {
        validationResult = await result.current.validateAndEnd(10, 80, 300)
      })

      expect(validationResult).toBeNull()
    })
  })

  describe('Browser Event Monitoring', () => {
    it('registers event listeners when session is active', async () => {
      const { result } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      )
      expect(window.addEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      )
      expect(document.addEventListener).toHaveBeenCalledWith(
        'copy',
        expect.any(Function)
      )
      expect(document.addEventListener).toHaveBeenCalledWith(
        'paste',
        expect.any(Function)
      )
    })

    it('removes event listeners when session ends', async () => {
      const { result, unmount } = renderHook(() => useAntiCheat(defaultOptions))

      await act(async () => {
        await result.current.startSession()
      })

      await act(async () => {
        await result.current.validateAndEnd(10, 80, 300)
      })

      unmount()

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      )
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      )
    })
  })

  describe('Disabled State', () => {
    it('does nothing when disabled', async () => {
      const { result } = renderHook(() =>
        useAntiCheat({ ...defaultOptions, enabled: false })
      )

      await act(async () => {
        await result.current.startSession()
      })

      await act(async () => {
        await result.current.recordAnswer(0, 1, 5000, 0)
      })

      const validationResult = await act(async () => {
        return await result.current.validateAndEnd(10, 80, 300)
      })

      expect(mockStartSession).not.toHaveBeenCalled()
      expect(mockRecordAnswer).not.toHaveBeenCalled()
      expect(validationResult).toBeNull()
    })
  })
})
