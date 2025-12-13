/**
 * Tests for Auth Store (Zustand)
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// Mock API
const mockPost = jest.fn()
const mockGet = jest.fn()

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: (...args: any[]) => mockPost(...args),
    get: (...args: any[]) => mockGet(...args),
  },
}))

// Import after mocks
import { useAuthStore, AuthProvider, useAuth } from '../auth-store'

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()

    // Reset store state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    })
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useAuthStore())

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('provides all required functions', () => {
      const { result } = renderHook(() => useAuthStore())

      expect(typeof result.current.login).toBe('function')
      expect(typeof result.current.register).toBe('function')
      expect(typeof result.current.logout).toBe('function')
      expect(typeof result.current.refreshUser).toBe('function')
      expect(typeof result.current.clearError).toBe('function')
    })
  })

  describe('Login', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      full_name: 'Test User',
      level: 5,
      total_xp: 500,
      current_streak: 7,
      subscription_type: 'free',
    }

    const mockAuthResponse = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      token_type: 'bearer',
      user: mockUser,
    }

    it('logs in successfully', async () => {
      mockPost.mockResolvedValue({ data: mockAuthResponse })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()

      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'access-token-123')
      expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token-123')
    })

    it('sets loading state during login', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockPost.mockReturnValue(promise)

      const { result } = renderHook(() => useAuthStore())

      // Start the login without awaiting
      let loginPromise: Promise<void>
      act(() => {
        loginPromise = result.current.login('test@example.com', 'password123')
      })

      // Check loading state before resolution
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ data: mockAuthResponse })
        await loginPromise!
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('handles login error', async () => {
      mockPost.mockRejectedValue({
        response: { data: { detail: 'Invalid credentials' } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'wrong-password')
        } catch (e) {
          // Expected error
        }
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBe('Invalid credentials')
    })

    it('handles network error', async () => {
      mockPost.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.login('test@example.com', 'password123')
        } catch (e) {
          // Expected error
        }
      })

      expect(result.current.error).toBe('Erreur de connexion')
    })
  })

  describe('Register', () => {
    const mockUser = {
      id: 1,
      email: 'new@example.com',
      username: 'newuser',
      level: 1,
      total_xp: 0,
      current_streak: 0,
      subscription_type: 'free',
    }

    const mockAuthResponse = {
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      token_type: 'bearer',
      user: mockUser,
    }

    it('registers successfully', async () => {
      mockPost.mockResolvedValue({ data: mockAuthResponse })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.register({
          email: 'new@example.com',
          password: 'password123',
          username: 'newuser',
          full_name: 'New User',
        })
      })

      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        email: 'new@example.com',
        password: 'password123',
        username: 'newuser',
        full_name: 'New User',
      })

      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('handles registration error', async () => {
      mockPost.mockRejectedValue({
        response: { data: { detail: 'Email already exists' } },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        try {
          await result.current.register({
            email: 'existing@example.com',
            password: 'password123',
            username: 'existinguser',
          })
        } catch (e) {
          // Expected error
        }
      })

      expect(result.current.error).toBe('Email already exists')
    })
  })

  describe('Logout', () => {
    it('logs out successfully', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com' } as any,
        isAuthenticated: true,
        isLoading: false,
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.error).toBeNull()

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token')
    })
  })

  describe('Refresh User', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      level: 10,
      total_xp: 1000,
      current_streak: 30,
      subscription_type: 'premium',
    }

    it('refreshes user data when token exists', async () => {
      localStorage.getItem = jest.fn().mockReturnValue('valid-token')
      mockGet.mockResolvedValue({ data: mockUser })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(mockGet).toHaveBeenCalledWith('/users/me')
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    it('does not refresh when no token exists', async () => {
      localStorage.getItem = jest.fn().mockReturnValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(mockGet).not.toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('clears tokens on refresh error', async () => {
      localStorage.getItem = jest.fn().mockReturnValue('invalid-token')
      mockGet.mockRejectedValue(new Error('Token expired'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('Clear Error', () => {
    it('clears error state', () => {
      useAuthStore.setState({ error: 'Some error' })

      const { result } = renderHook(() => useAuthStore())

      expect(result.current.error).toBe('Some error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('AuthProvider and useAuth', () => {
    it('provides auth state through context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      )

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(typeof result.current.login).toBe('function')
    })

    it('throws error when useAuth used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = jest.fn()

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within AuthProvider')

      console.error = originalError
    })
  })

  describe('Token Storage', () => {
    it('stores tokens in localStorage on login', async () => {
      mockPost.mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          user: { id: 1 },
        },
      })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'new-access-token')
      expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'new-refresh-token')
    })

    it('removes tokens from localStorage on logout', () => {
      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.logout()
      })

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token')
    })
  })
})
