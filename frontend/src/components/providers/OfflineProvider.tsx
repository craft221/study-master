'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { syncService } from '@/services/syncService'
import { offlineStorage } from '@/lib/offlineStorage'

interface OfflineContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  isReady: boolean
  sync: () => Promise<void>
  forceSync: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  isReady: false,
  sync: async () => {},
  forceSync: async () => {},
})

export function useOfflineContext() {
  return useContext(OfflineContext)
}

interface OfflineProviderProps {
  children: ReactNode
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Initialiser
    const init = async () => {
      try {
        // Initialiser le stockage hors ligne
        await offlineStorage.init()

        // Initialiser le service de synchronisation
        await syncService.init()

        // Mettre à jour l'état
        setIsOnline(navigator.onLine)
        const count = await syncService.getPendingCount()
        setPendingCount(count)
        setIsReady(true)

        console.log('[OfflineProvider] Initialisé avec succès')
      } catch (error) {
        console.error('[OfflineProvider] Erreur d\'initialisation:', error)
        setIsReady(true) // Continuer même en cas d'erreur
      }
    }

    init()

    // Écouter les changements de connexion
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Écouter les événements de synchronisation
    const unsubscribe = syncService.addListener((event) => {
      setIsSyncing(event.status === 'syncing')
      if (event.pendingCount !== undefined) {
        setPendingCount(event.pendingCount)
      }
    })

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[OfflineProvider] Service Worker enregistré:', registration.scope)

          // Vérifier les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouvelle version disponible
                  console.log('[OfflineProvider] Nouvelle version disponible')
                  // Optionnel: notifier l'utilisateur
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[OfflineProvider] Erreur d\'enregistrement SW:', error)
        })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
      syncService.stopAutoSync()
    }
  }, [])

  const sync = async () => {
    await syncService.syncAll()
    const count = await syncService.getPendingCount()
    setPendingCount(count)
  }

  const forceSync = async () => {
    await syncService.forceSyncAll()
    const count = await syncService.getPendingCount()
    setPendingCount(count)
  }

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        isReady,
        sync,
        forceSync,
      }}
    >
      {children}
    </OfflineContext.Provider>
  )
}

export default OfflineProvider
