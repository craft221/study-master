import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Déterminer l'URL de l'API en s'assurant que HTTPS est utilisé en production
const getRawApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL
  if (envUrl) {
    // Forcer HTTPS si la page est servie en HTTPS (évite Mixed Content)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://')) {
      return envUrl.replace('http://', 'https://')
    }
    return envUrl
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://api.studera.app'
  }
  return 'http://localhost:8000'
}

const API_URL = getRawApiUrl()
// Éviter le double /api/v1 si l'URL en contient déjà
const API_BASE = API_URL.includes('/api/v1') ? '' : '/api/v1'

// Configuration des timeouts
const REQUEST_TIMEOUT = 30000 // 30 secondes
const REFRESH_TOKEN_TIMEOUT = 10000 // 10 secondes pour le refresh

// Compteur de retry pour éviter les boucles infinies
const MAX_RETRY_COUNT = 1
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []

// Traiter la file d'attente des requêtes en attente du refresh
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error)
    } else if (token) {
      // Verify tokens weren't cleared (user logged out) during refresh
      if (tokenStorage.getAccessToken()) {
        promise.resolve(token)
      } else {
        promise.reject(new Error('Session terminée'))
      }
    }
  })
  failedQueue = []
}

// Helper pour vérifier si on est côté client
const isClient = typeof window !== 'undefined'

// Service de stockage abstrait
const tokenStorage = {
  getAccessToken: (): string | null => {
    if (!isClient) return null
    return localStorage.getItem('access_token')
  },
  getRefreshToken: (): string | null => {
    if (!isClient) return null
    return localStorage.getItem('refresh_token')
  },
  setAccessToken: (token: string): void => {
    if (!isClient) return
    localStorage.setItem('access_token', token)
  },
  setRefreshToken: (token: string): void => {
    if (!isClient) return
    localStorage.setItem('refresh_token', token)
  },
  clearTokens: (): void => {
    if (!isClient) return
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
}

// Instance Axios principale
export const api = axios.create({
  baseURL: `${API_URL}${API_BASE}`,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Extend AxiosRequestConfig pour inclure nos propriétés custom
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _retryCount?: number
}

// Request interceptor pour ajouter le token
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor pour gérer les erreurs et le refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig

    // Si pas de config ou pas de réponse, rejeter directement
    if (!originalRequest || !error.response) {
      return Promise.reject(error)
    }

    const { status } = error.response

    // Vérifier le nombre de retry pour éviter les boucles infinies
    const retryCount = originalRequest._retryCount || 0
    if (retryCount >= MAX_RETRY_COUNT) {
      // Trop de retry, déconnecter et rejeter
      tokenStorage.clearTokens()
      if (isClient && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('Session expirée. Veuillez vous reconnecter.'))
    }

    // Ne pas essayer de refresh pour les routes d'auth
    const isAuthRoute = originalRequest.url?.includes('/auth/')

    // Si 401 et pas déjà en cours de refresh et pas une route d'auth
    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      // Marquer comme retry
      originalRequest._retry = true
      originalRequest._retryCount = retryCount + 1

      // Si un refresh est déjà en cours, mettre en file d'attente
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch(err => Promise.reject(err))
      }

      isRefreshing = true

      const refreshToken = tokenStorage.getRefreshToken()

      // Si pas de refresh token, déconnecter
      if (!refreshToken) {
        isRefreshing = false
        tokenStorage.clearTokens()
        if (isClient && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(new Error('Session expirée'))
      }

      try {
        // Utiliser une instance axios séparée pour le refresh (évite les intercepteurs)
        const response = await axios.post(
          `${API_URL}${API_BASE}/auth/refresh`,
          { refresh_token: refreshToken },
          { timeout: REFRESH_TOKEN_TIMEOUT }
        )

        const { access_token, refresh_token: new_refresh_token } = response.data

        // Verify tokens weren't cleared (user logged out) during refresh
        if (!tokenStorage.getRefreshToken()) {
          processQueue(new Error('Session terminée'), null)
          return Promise.reject(new Error('Session terminée'))
        }

        // Sauvegarder les nouveaux tokens (rotation du refresh token)
        tokenStorage.setAccessToken(access_token)
        if (new_refresh_token) {
          tokenStorage.setRefreshToken(new_refresh_token)
        }

        // Traiter les requêtes en attente
        processQueue(null, access_token)

        // Réessayer la requête originale
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh échoué
        processQueue(refreshError as Error, null)

        // Nettoyer les tokens et rediriger
        tokenStorage.clearTokens()
        if (isClient && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(new Error('Session expirée. Veuillez vous reconnecter.'))
      } finally {
        isRefreshing = false
      }
    }

    // Pour les autres erreurs, rejeter normalement
    return Promise.reject(error)
  }
)

export default api
