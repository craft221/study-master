/**
 * Tests for useWebSocket hooks
 */
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock the WebSocket service
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockSend = jest.fn()
const mockOn = jest.fn()
const mockOnConnect = jest.fn()
const mockOnDisconnect = jest.fn()
const mockOnError = jest.fn()
const mockJoinRoom = jest.fn()
const mockLeaveRoom = jest.fn()
const mockSendGroupMessage = jest.fn()
const mockSendTyping = jest.fn()
const mockUpdatePresence = jest.fn()

jest.mock('@/services/websocket', () => ({
  wsService: {
    connect: (...args: any[]) => mockConnect(...args),
    disconnect: (...args: any[]) => mockDisconnect(...args),
    send: (...args: any[]) => mockSend(...args),
    on: (...args: any[]) => mockOn(...args),
    onConnect: (...args: any[]) => mockOnConnect(...args),
    onDisconnect: (...args: any[]) => mockOnDisconnect(...args),
    onError: (...args: any[]) => mockOnError(...args),
    joinRoom: (...args: any[]) => mockJoinRoom(...args),
    leaveRoom: (...args: any[]) => mockLeaveRoom(...args),
    sendGroupMessage: (...args: any[]) => mockSendGroupMessage(...args),
    sendTyping: (...args: any[]) => mockSendTyping(...args),
    updatePresence: (...args: any[]) => mockUpdatePresence(...args),
  },
}))

import {
  useWebSocket,
  useWebSocketMessage,
  useRoom,
  useRealTimeNotifications,
  usePresence,
} from '../useWebSocket'

describe('useWebSocket Hook', () => {
  let connectCallback: (() => void) | null = null
  let disconnectCallback: (() => void) | null = null
  let errorCallback: (() => void) | null = null

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up localStorage mock
    localStorage.getItem = jest.fn().mockReturnValue('test-token')

    // Capture callbacks
    mockOnConnect.mockImplementation((cb) => {
      connectCallback = cb
      return jest.fn()
    })
    mockOnDisconnect.mockImplementation((cb) => {
      disconnectCallback = cb
      return jest.fn()
    })
    mockOnError.mockImplementation((cb) => {
      errorCallback = cb
      return jest.fn()
    })

    mockConnect.mockResolvedValue(undefined)
  })

  describe('Initial State', () => {
    it('initializes with correct default state', () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('provides connect and disconnect functions', () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      expect(typeof result.current.connect).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
      expect(typeof result.current.send).toBe('function')
    })
  })

  describe('Auto Connect', () => {
    it('auto connects when autoConnect is true and token exists', async () => {
      renderHook(() => useWebSocket({ autoConnect: true }))

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled()
      })
    })

    it('does not auto connect when autoConnect is false', () => {
      renderHook(() => useWebSocket({ autoConnect: false }))

      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('does not auto connect when no token exists', () => {
      localStorage.getItem = jest.fn().mockReturnValue(null)

      renderHook(() => useWebSocket({ autoConnect: true }))

      expect(mockConnect).not.toHaveBeenCalled()
    })
  })

  describe('Connection Events', () => {
    it('updates isConnected on connect event', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      expect(result.current.isConnected).toBe(false)

      act(() => {
        if (connectCallback) connectCallback()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.isConnecting).toBe(false)
    })

    it('updates isConnected on disconnect event', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      act(() => {
        if (connectCallback) connectCallback()
      })

      expect(result.current.isConnected).toBe(true)

      act(() => {
        if (disconnectCallback) disconnectCallback()
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('sets error on error event', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      act(() => {
        if (errorCallback) errorCallback()
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Manual Connection', () => {
    it('connect function connects with token', async () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      await act(async () => {
        await result.current.connect()
      })

      expect(mockConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
        })
      )
    })

    it('connect sets error when no token available', async () => {
      localStorage.getItem = jest.fn().mockReturnValue(null)

      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toBeTruthy()
      expect(mockConnect).not.toHaveBeenCalled()
    })

    it('disconnect function disconnects', () => {
      const { result } = renderHook(() => useWebSocket({ autoConnect: false }))

      act(() => {
        result.current.disconnect()
      })

      expect(mockDisconnect).toHaveBeenCalled()
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('unsubscribes from events on unmount', () => {
      const unsubConnect = jest.fn()
      const unsubDisconnect = jest.fn()
      const unsubError = jest.fn()

      mockOnConnect.mockReturnValue(unsubConnect)
      mockOnDisconnect.mockReturnValue(unsubDisconnect)
      mockOnError.mockReturnValue(unsubError)

      const { unmount } = renderHook(() => useWebSocket({ autoConnect: false }))

      unmount()

      expect(unsubConnect).toHaveBeenCalled()
      expect(unsubDisconnect).toHaveBeenCalled()
      expect(unsubError).toHaveBeenCalled()
    })
  })
})

describe('useWebSocketMessage Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('subscribes to message type on mount', () => {
    const handler = jest.fn()
    mockOn.mockReturnValue(jest.fn())

    renderHook(() => useWebSocketMessage('test_event', handler))

    expect(mockOn).toHaveBeenCalledWith('test_event', expect.any(Function))
  })

  it('calls handler when message is received', () => {
    const handler = jest.fn()
    let capturedHandler: ((data: any) => void) | null = null

    mockOn.mockImplementation((type, cb) => {
      capturedHandler = cb
      return jest.fn()
    })

    renderHook(() => useWebSocketMessage('test_event', handler))

    act(() => {
      if (capturedHandler) {
        capturedHandler({ data: 'test' })
      }
    })

    expect(handler).toHaveBeenCalledWith({ data: 'test' })
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = jest.fn()
    mockOn.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useWebSocketMessage('test_event', jest.fn()))

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('useRoom Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOn.mockReturnValue(jest.fn())
  })

  it('joins room when roomId is provided', () => {
    renderHook(() => useRoom('group_123'))

    expect(mockJoinRoom).toHaveBeenCalledWith('group_123')
  })

  it('does not join room when roomId is null', () => {
    renderHook(() => useRoom(null))

    expect(mockJoinRoom).not.toHaveBeenCalled()
  })

  it('leaves room on unmount', () => {
    const { unmount } = renderHook(() => useRoom('group_123'))

    unmount()

    expect(mockLeaveRoom).toHaveBeenCalledWith('group_123')
  })

  it('provides sendMessage function', () => {
    const { result } = renderHook(() => useRoom('group_123'))

    act(() => {
      result.current.sendMessage('Hello')
    })

    expect(mockSendGroupMessage).toHaveBeenCalledWith(123, 'Hello')
  })

  it('provides setTyping function', () => {
    const { result } = renderHook(() => useRoom('group_123'))

    act(() => {
      result.current.setTyping(true)
    })

    expect(mockSendTyping).toHaveBeenCalledWith('group_123', true)
  })

  it('initializes with empty messages array', () => {
    const { result } = renderHook(() => useRoom('group_123'))

    expect(result.current.messages).toEqual([])
  })

  it('clearMessages resets messages array', () => {
    const { result } = renderHook(() => useRoom('group_123'))

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
  })
})

describe('useRealTimeNotifications Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('subscribes to notification events', () => {
    const handler = jest.fn()
    mockOn.mockReturnValue(jest.fn())

    renderHook(() => useRealTimeNotifications(handler))

    expect(mockOn).toHaveBeenCalledWith('notification', expect.any(Function))
  })

  it('calls handler with notification data', () => {
    const handler = jest.fn()
    let capturedHandler: ((data: any) => void) | null = null

    mockOn.mockImplementation((type, cb) => {
      capturedHandler = cb
      return jest.fn()
    })

    renderHook(() => useRealTimeNotifications(handler))

    act(() => {
      if (capturedHandler) {
        capturedHandler({ notification: { id: 1, message: 'Test' } })
      }
    })

    expect(handler).toHaveBeenCalledWith({ id: 1, message: 'Test' })
  })
})

describe('usePresence Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOn.mockReturnValue(jest.fn())
  })

  it('initializes with empty presence', () => {
    const { result } = renderHook(() => usePresence('group_123'))

    expect(result.current.presence).toEqual({})
    expect(result.current.onlineCount).toBe(0)
  })

  it('provides updateStatus function', () => {
    const { result } = renderHook(() => usePresence('group_123'))

    act(() => {
      result.current.updateStatus('away', { activity: 'idle' })
    })

    expect(mockUpdatePresence).toHaveBeenCalledWith('group_123', 'away', { activity: 'idle' })
  })

  it('does not update status when roomId is null', () => {
    const { result } = renderHook(() => usePresence(null))

    act(() => {
      result.current.updateStatus('online')
    })

    expect(mockUpdatePresence).not.toHaveBeenCalled()
  })
})
