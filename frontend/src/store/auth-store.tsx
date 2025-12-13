'use client'

import { create } from 'zustand'
import { ReactNode, createContext, useContext } from 'react'
import api from '@/lib/api'
import { syncService } from '@/services/syncService'

// Types pour l'authentification
interface User {
  id: number
  email: string
  username: string
  full_name?: string
  avatar_url?: string
  level: number
  total_xp: number
  current_streak: number
  subscription_type: string
}

interface RegisterData {
  email: string
  password: string
  username: string
  full_name?: string
}

interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  clearError: () => void
}

// Service de stockage abstrait pour éviter les accès directs à localStorage
const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('access_token')
  },
  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refresh_token')
  },
  setTokens: (accessToken: string, refreshToken: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
  },
  clearTokens: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password
      })

      const { access_token, refresh_token, user } = response.data

      tokenStorage.setTokens(access_token, refresh_token)
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur de connexion'
      set({
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
        user: null
      })
      throw new Error(errorMessage)
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post<AuthResponse>('/auth/register', data)

      const { access_token, refresh_token, user } = response.data

      tokenStorage.setTokens(access_token, refresh_token)
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Erreur lors de l\'inscription'
      set({
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
        user: null
      })
      throw new Error(errorMessage)
    }
  },

  logout: () => {
    // Arrêter le SyncService avant de supprimer les tokens
    syncService.stopAutoSync()

    tokenStorage.clearTokens()
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    })
  },

  refreshUser: async () => {
    const token = tokenStorage.getAccessToken()
    if (!token) {
      set({ isLoading: false, isAuthenticated: false, user: null })
      return
    }

    try {
      const response = await api.get<User>('/users/me')
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
    } catch (error: any) {
      // Token invalide ou expiré
      tokenStorage.clearTokens()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={useAuthStore()}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
