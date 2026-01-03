/**
 * Hook pour la gestion du mode hors ligne
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { offlineStorage } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'

interface OfflineState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: Date | null
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof window !== 'undefined' && typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
  })

  useEffect(() => {
    // Vérification SSR
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }))
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Écouter les événements de synchronisation
    const unsubscribe = syncService.addListener((event) => {
      setState(prev => ({
        ...prev,
        isSyncing: event.status === 'syncing',
        pendingCount: event.pendingCount ?? prev.pendingCount,
        lastSyncTime: event.result ? new Date() : prev.lastSyncTime,
      }))
    })

    // Charger le nombre d'actions en attente
    syncService.getPendingCount().then(count => {
      setState(prev => ({ ...prev, pendingCount: count }))
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
    }
  }, [])

  const sync = useCallback(async () => {
    return syncService.syncAll()
  }, [])

  const forceSync = useCallback(async () => {
    return syncService.forceSyncAll()
  }, [])

  return {
    ...state,
    sync,
    forceSync,
  }
}

/**
 * Hook pour récupérer des données avec fallback hors ligne
 */
export function useOfflineData<T>(
  fetchOnline: () => Promise<T>,
  getOffline: () => Promise<T | null>,
  saveOffline: (data: T) => Promise<void>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const { isOnline } = useOffline()

  // Utiliser des refs pour éviter les boucles infinies
  // Les fonctions passées en paramètre sont recréées à chaque render
  const fetchOnlineRef = useRef(fetchOnline)
  const getOfflineRef = useRef(getOffline)
  const saveOfflineRef = useRef(saveOffline)

  // Mettre à jour les refs à chaque render
  useEffect(() => {
    fetchOnlineRef.current = fetchOnline
    getOfflineRef.current = getOffline
    saveOfflineRef.current = saveOffline
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (isOnline) {
        // Essayer de récupérer les données en ligne
        const onlineData = await fetchOnlineRef.current()
        setData(onlineData)
        setIsFromCache(false)
        // Sauvegarder en cache
        await saveOfflineRef.current(onlineData)
      } else {
        // Utiliser les données en cache
        const offlineData = await getOfflineRef.current()
        if (offlineData) {
          setData(offlineData)
          setIsFromCache(true)
        } else {
          throw new Error('Données non disponibles hors ligne')
        }
      }
    } catch (err) {
      // Essayer le cache en cas d'erreur réseau
      try {
        const offlineData = await getOfflineRef.current()
        if (offlineData) {
          setData(offlineData)
          setIsFromCache(true)
        } else {
          setError(err instanceof Error ? err : new Error('Erreur inconnue'))
        }
      } catch {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      }
    } finally {
      setLoading(false)
    }
  }, [isOnline]) // Plus besoin des fonctions dans les deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData()
  }, [fetchData, ...deps])

  return {
    data,
    loading,
    error,
    isFromCache,
    refetch: fetchData,
  }
}

/**
 * Hook pour les notes hors ligne
 */
export function useOfflineNotes() {
  return useOfflineData(
    async () => {
      const { default: api } = await import('@/lib/api')
      const response = await api.get('/notes/')
      return response.data.notes || response.data
    },
    async () => offlineStorage.getNotes(),
    async (notes) => offlineStorage.saveNotes(notes)
  )
}

/**
 * Hook pour les flashcards hors ligne
 */
export function useOfflineDecks() {
  return useOfflineData(
    async () => {
      const { default: api } = await import('@/lib/api')
      const response = await api.get('/flashcards/decks/')
      return response.data.decks || response.data
    },
    async () => offlineStorage.getDecks(),
    async (decks) => offlineStorage.saveDecks(decks)
  )
}

/**
 * Hook pour le calendrier hors ligne
 */
export function useOfflineSchedules() {
  return useOfflineData(
    async () => {
      const { default: api } = await import('@/lib/api')
      const response = await api.get('/schedules/')
      return response.data.schedules || response.data
    },
    async () => offlineStorage.getSchedules(),
    async (schedules) => offlineStorage.saveSchedules(schedules)
  )
}

/**
 * Hook pour le profil utilisateur hors ligne
 */
export function useOfflineProfile() {
  return useOfflineData(
    async () => {
      const { default: api } = await import('@/lib/api')
      const response = await api.get('/users/me')
      return response.data
    },
    async () => offlineStorage.getUserProfile(),
    async (profile) => offlineStorage.saveUserProfile(profile)
  )
}

/**
 * Hook pour les sujets hors ligne
 */
export function useOfflineSubjects() {
  return useOfflineData(
    async () => {
      const { default: api } = await import('@/lib/api')
      const response = await api.get('/subjects/')
      return response.data
    },
    async () => offlineStorage.getSubjects(),
    async (subjects) => offlineStorage.saveSubjects(subjects)
  )
}

export default useOffline
