/**
 * Service Auth - API Client pour l'authentification
 */

import api from '@/lib/api'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  full_name?: string
}

export interface UserResponse {
  id: number
  email: string
  username: string
  full_name: string | null
  avatar_url: string | null
  role: string
  subscription_type: string
  total_xp: number
  level: number
  current_streak: number
  is_active: boolean
  is_verified: boolean
  created_at: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserResponse
}

export interface RefreshTokenResponse {
  access_token: string
  token_type: string
}

export const authService = {
  /**
   * Connexion utilisateur
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data)

    // Stocker les tokens
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token)
    }
    if (response.data.refresh_token) {
      localStorage.setItem('refresh_token', response.data.refresh_token)
    }

    return response.data
  },

  /**
   * Inscription utilisateur
   */
  register: async (data: RegisterRequest): Promise<UserResponse> => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  /**
   * Rafraîchir le token d'accès
   */
  refresh: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await api.post('/auth/refresh', { refresh_token: refreshToken })

    // Mettre à jour le token
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token)
    }

    return response.data
  },

  /**
   * Déconnexion utilisateur
   */
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    sessionStorage.removeItem('spark_welcome_shown')
    window.location.href = '/login'
  },

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('access_token')
  },

  /**
   * Récupérer le token d'accès
   */
  getAccessToken: (): string | null => {
    return localStorage.getItem('access_token')
  },

  /**
   * Récupérer le refresh token
   */
  getRefreshToken: (): string | null => {
    return localStorage.getItem('refresh_token')
  },

  /**
   * Demande de réinitialisation de mot de passe
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  /**
   * Réinitialisation du mot de passe avec token
   */
  resetPassword: async (token: string, new_password: string, confirm_password: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', { token, new_password, confirm_password })
    return response.data
  }
}

export default authService
