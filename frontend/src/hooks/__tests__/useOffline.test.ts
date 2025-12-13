/**
 * Tests for useOffline hook
 */
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock dependencies
jest.mock('@/lib/offlineStorage', () => ({
  offlineStorage: {
    getNotes: jest.fn().mockResolvedValue([]),
    saveNotes: jest.fn().mockResolvedValue(undefined),
    getDecks: jest.fn().mockResolvedValue([]),
    saveDecks: jest.fn().mockResolvedValue(undefined),
    getSchedules: jest.fn().mockResolvedValue([]),
    saveSchedules: jest.fn().mockResolvedValue(undefined),
    getUserProfile: jest.fn().mockResolvedValue(null),
    saveUserProfile: jest.fn().mockResolvedValue(undefined),
    getSubjects: jest.fn().mockResolvedValue([]),
    saveSubjects: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/services/syncService', () => ({
  syncService: {
    addListener: jest.fn().mockReturnValue(jest.fn()),
    getPendingCount: jest.fn().mockResolvedValue(0),
    syncAll: jest.fn().mockResolvedValue({ success: true }),
    forceSyncAll: jest.fn().mockResolvedValue({ success: true }),
  },
}))

// Import after mocks
import { useOffline, useOfflineData } from '../useOffline'
import { syncService } from '@/services/syncService'

describe('useOffline Hook', () => {
  let originalNavigator: Navigator
  let originalAddEventListener: typeof window.addEventListener
  let originalRemoveEventListener: typeof window.removeEventListener
  let listeners: Map<string, EventListener[]>

  beforeEach(() => {
    originalNavigator = window.navigator
    originalAddEventListener = window.addEventListener
    originalRemoveEventListener = window.removeEventListener
    listeners = new Map()

    // Mock addEventListener/removeEventListener
    window.addEventListener = jest.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, [])
      }
      listeners.get(event)!.push(handler as EventListener)
    })

    window.removeEventListener = jest.fn((event, handler) => {
      const handlers = listeners.get(event)
      if (handlers) {
        const index = handlers.indexOf(handler as EventListener)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    })

    // Mock navigator.onLine
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: { ...originalNavigator, onLine: true },
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: originalNavigator,
    })
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
  })

  describe('Initial State', () => {
    it('initializes with online status from navigator', () => {
      const { result } = renderHook(() => useOffline())

      expect(result.current.isOnline).toBe(true)
      expect(result.current.isSyncing).toBe(false)
      expect(result.current.pendingCount).toBe(0)
    })

    it('initializes as offline when navigator.onLine is false', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        value: { ...originalNavigator, onLine: false },
      })

      const { result } = renderHook(() => useOffline())

      expect(result.current.isOnline).toBe(false)
    })
  })

  describe('Online/Offline Events', () => {
    it('registers online and offline event listeners', () => {
      renderHook(() => useOffline())

      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
    })

    it('updates isOnline to true on online event', () => {
      Object.defineProperty(window, 'navigator', {
        writable: true,
        value: { ...originalNavigator, onLine: false },
      })

      const { result } = renderHook(() => useOffline())

      expect(result.current.isOnline).toBe(false)

      act(() => {
        const onlineHandlers = listeners.get('online')
        if (onlineHandlers) {
          onlineHandlers.forEach((handler) => handler(new Event('online')))
        }
      })

      expect(result.current.isOnline).toBe(true)
    })

    it('updates isOnline to false on offline event', () => {
      const { result } = renderHook(() => useOffline())

      expect(result.current.isOnline).toBe(true)

      act(() => {
        const offlineHandlers = listeners.get('offline')
        if (offlineHandlers) {
          offlineHandlers.forEach((handler) => handler(new Event('offline')))
        }
      })

      expect(result.current.isOnline).toBe(false)
    })

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useOffline())

      unmount()

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })

  describe('Sync Service Integration', () => {
    it('adds sync listener on mount', () => {
      renderHook(() => useOffline())

      expect(syncService.addListener).toHaveBeenCalled()
    })

    it('loads pending count on mount', async () => {
      ;(syncService.getPendingCount as jest.Mock).mockResolvedValue(5)

      const { result } = renderHook(() => useOffline())

      await waitFor(() => {
        expect(result.current.pendingCount).toBe(5)
      })
    })

    it('sync function calls syncService.syncAll', async () => {
      const { result } = renderHook(() => useOffline())

      await act(async () => {
        await result.current.sync()
      })

      expect(syncService.syncAll).toHaveBeenCalled()
    })

    it('forceSync function calls syncService.forceSyncAll', async () => {
      const { result } = renderHook(() => useOffline())

      await act(async () => {
        await result.current.forceSync()
      })

      expect(syncService.forceSyncAll).toHaveBeenCalled()
    })
  })

  describe('Sync Listener Events', () => {
    it('updates isSyncing when sync status is syncing', async () => {
      let capturedListener: ((event: any) => void) | null = null
      ;(syncService.addListener as jest.Mock).mockImplementation((listener) => {
        capturedListener = listener
        return jest.fn()
      })

      const { result } = renderHook(() => useOffline())

      expect(result.current.isSyncing).toBe(false)

      act(() => {
        if (capturedListener) {
          capturedListener({ status: 'syncing' })
        }
      })

      expect(result.current.isSyncing).toBe(true)
    })

    it('updates pendingCount from sync events', async () => {
      let capturedListener: ((event: any) => void) | null = null
      ;(syncService.addListener as jest.Mock).mockImplementation((listener) => {
        capturedListener = listener
        return jest.fn()
      })

      const { result } = renderHook(() => useOffline())

      act(() => {
        if (capturedListener) {
          capturedListener({ status: 'idle', pendingCount: 10 })
        }
      })

      expect(result.current.pendingCount).toBe(10)
    })

    it('updates lastSyncTime when sync result is received', () => {
      let capturedListener: ((event: any) => void) | null = null
      ;(syncService.addListener as jest.Mock).mockImplementation((listener) => {
        capturedListener = listener
        return jest.fn()
      })

      const { result } = renderHook(() => useOffline())

      expect(result.current.lastSyncTime).toBeNull()

      act(() => {
        if (capturedListener) {
          capturedListener({ status: 'completed', result: { success: true } })
        }
      })

      expect(result.current.lastSyncTime).toBeInstanceOf(Date)
    })
  })
})

describe('useOfflineData Hook', () => {
  const mockFetchOnline = jest.fn()
  const mockGetOffline = jest.fn()
  const mockSaveOffline = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchOnline.mockReset()
    mockGetOffline.mockReset()
    mockSaveOffline.mockReset()

    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: { onLine: true },
    })
  })

  it('fetches online data when online', async () => {
    const mockData = [{ id: 1, name: 'Test' }]
    mockFetchOnline.mockResolvedValue(mockData)
    mockSaveOffline.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useOfflineData(mockFetchOnline, mockGetOffline, mockSaveOffline)
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.isFromCache).toBe(false)
    expect(mockFetchOnline).toHaveBeenCalled()
    expect(mockSaveOffline).toHaveBeenCalledWith(mockData)
  })

  it('fetches offline data when offline', async () => {
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: { onLine: false },
    })

    const mockData = [{ id: 1, name: 'Cached' }]
    mockGetOffline.mockResolvedValue(mockData)

    const { result } = renderHook(() =>
      useOfflineData(mockFetchOnline, mockGetOffline, mockSaveOffline)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.isFromCache).toBe(true)
    expect(mockFetchOnline).not.toHaveBeenCalled()
  })

  it('falls back to cache on network error', async () => {
    mockFetchOnline.mockRejectedValue(new Error('Network error'))
    const mockCachedData = [{ id: 1, name: 'Cached' }]
    mockGetOffline.mockResolvedValue(mockCachedData)

    const { result } = renderHook(() =>
      useOfflineData(mockFetchOnline, mockGetOffline, mockSaveOffline)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockCachedData)
    expect(result.current.isFromCache).toBe(true)
  })

  it('sets error when offline data is not available', async () => {
    Object.defineProperty(window, 'navigator', {
      writable: true,
      value: { onLine: false },
    })

    mockGetOffline.mockResolvedValue(null)

    const { result } = renderHook(() =>
      useOfflineData(mockFetchOnline, mockGetOffline, mockSaveOffline)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.data).toBeNull()
  })

  it('refetch function reloads data', async () => {
    const mockData = [{ id: 1 }]
    mockFetchOnline.mockResolvedValue(mockData)
    mockSaveOffline.mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useOfflineData(mockFetchOnline, mockGetOffline, mockSaveOffline)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockFetchOnline.mockClear()
    const newData = [{ id: 2 }]
    mockFetchOnline.mockResolvedValue(newData)

    await act(async () => {
      await result.current.refetch()
    })

    expect(mockFetchOnline).toHaveBeenCalled()
    expect(result.current.data).toEqual(newData)
  })
})
