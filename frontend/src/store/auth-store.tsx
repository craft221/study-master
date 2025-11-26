'use client'

import { create } from 'zustand'
import { ReactNode, createContext, useContext } from 'react'

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

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      // TODO: Implémenter l'appel API
      console.log('Login:', email, password)
      // const response = await api.post('/auth/login', { email, password })
      // localStorage.setItem('access_token', response.data.access_token)
      // localStorage.setItem('refresh_token', response.data.refresh_token)
      // set({ user: response.data.user, isAuthenticated: true })
    } catch (error) {
      throw error
    }
  },

  register: async (data: any) => {
    try {
      // TODO: Implémenter l'appel API
      console.log('Register:', data)
      // const response = await api.post('/auth/register', data)
      // localStorage.setItem('access_token', response.data.access_token)
      // localStorage.setItem('refresh_token', response.data.refresh_token)
      // set({ user: response.data.user, isAuthenticated: true })
    } catch (error) {
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  refreshUser: async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        set({ isLoading: false })
        return
      }
      
      // TODO: Implémenter l'appel API
      // const response = await api.get('/auth/me')
      // set({ user: response.data, isAuthenticated: true, isLoading: false })
      set({ isLoading: false })
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
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
