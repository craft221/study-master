'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { wsService } from '@/services/websocket'
import { useToast } from '@/hooks/use-toast'

interface WebSocketContextType {
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => void
  send: (message: any) => boolean
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  send: () => false,
  joinRoom: () => {},
  leaveRoom: () => {}
})

export function useWebSocketContext() {
  return useContext(WebSocketContext)
}

interface WebSocketProviderProps {
  children: ReactNode
  autoConnect?: boolean
}

export function WebSocketProvider({ children, autoConnect = true }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const { toast } = useToast()

  const connect = useCallback(async () => {
    // Vérification SSR - window/localStorage n'existent pas côté serveur
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      console.log('[WebSocketProvider] Pas de token, connexion impossible')
      return
    }

    setIsConnecting(true)

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || window.location.host
      const wsUrl = `${wsProtocol}//${wsHost}/api/v1/ws`

      await wsService.connect({
        url: wsUrl,
        token,
        reconnectInterval: 3000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
      })
    } catch (error) {
      console.error('[WebSocketProvider] Erreur de connexion:', error)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    wsService.disconnect()
  }, [])

  useEffect(() => {
    // Handlers de connexion
    const unsubConnect = wsService.onConnect(() => {
      setIsConnected(true)
      setIsConnecting(false)
      console.log('[WebSocketProvider] Connecté')
    })

    const unsubDisconnect = wsService.onDisconnect(() => {
      setIsConnected(false)
      console.log('[WebSocketProvider] Déconnecté')
    })

    const unsubError = wsService.onError((error) => {
      console.error('[WebSocketProvider] Erreur:', error)
      toast({
        title: 'Connexion temps réel',
        description: 'La connexion temps réel a été interrompue. Reconnexion en cours...',
        variant: 'destructive'
      })
    })

    // Écouter les notifications pour les afficher en toast
    const unsubNotification = wsService.on('notification', (data) => {
      if (data.notification) {
        toast({
          title: data.notification.title,
          description: data.notification.message
        })
      }
    })

    // Connexion automatique si demandé
    if (autoConnect) {
      const token = localStorage.getItem('access_token')
      if (token) {
        connect()
      }
    }

    return () => {
      unsubConnect()
      unsubDisconnect()
      unsubError()
      unsubNotification()
      wsService.disconnect()
    }
  }, [autoConnect, connect, toast])

  // Reconnecter quand le token change
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token') {
        if (e.newValue) {
          connect()
        } else {
          disconnect()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [connect, disconnect])

  const value: WebSocketContextType = {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    send: wsService.send.bind(wsService),
    joinRoom: wsService.joinRoom.bind(wsService),
    leaveRoom: wsService.leaveRoom.bind(wsService)
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export default WebSocketProvider
