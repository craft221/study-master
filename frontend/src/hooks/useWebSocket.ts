/**
 * Hooks React pour WebSocket
 * Avec gestion sécurisée des URLs (env vars + fallback automatique)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { wsService } from '@/services/websocket'

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

/**
 * Génère l'URL WebSocket de manière sécurisée
 * Utilise les variables d'environnement ou détecte automatiquement en production
 */
function getWebSocketUrl(): string {
  // 1. Priorité à la variable d'environnement
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL
  }

  // 2. En environnement browser, détecter automatiquement
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host

    // En développement local
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return 'ws://localhost:8000/api/v1/ws'
    }

    // En production, utiliser le même host
    return `${protocol}//${host}/api/v1/ws`
  }

  // 3. Fallback pour SSR
  return 'ws://localhost:8000/api/v1/ws'
}

/**
 * Hook principal pour la connexion WebSocket
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true } = options
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubConnect = wsService.onConnect(() => {
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    })

    const unsubDisconnect = wsService.onDisconnect(() => {
      setIsConnected(false)
    })

    const unsubError = wsService.onError(() => {
      setError(new Error('Erreur de connexion WebSocket'))
    })

    // Connecter automatiquement si demandé
    if (autoConnect) {
      const token = localStorage.getItem('access_token')
      if (token) {
        const wsUrl = getWebSocketUrl()
        setIsConnecting(true)
        wsService.connect({ url: wsUrl, token }).catch(err => {
          setError(err)
          setIsConnecting(false)
        })
      }
    }

    return () => {
      unsubConnect()
      unsubDisconnect()
      unsubError()
    }
  }, [autoConnect])

  const connect = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setError(new Error('Token non disponible'))
      return
    }

    const wsUrl = getWebSocketUrl()
    setIsConnecting(true)

    try {
      await wsService.connect({ url: wsUrl, token })
    } catch (err) {
      setError(err as Error)
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    wsService.disconnect()
    setIsConnected(false)
  }, [])

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send: wsService.send.bind(wsService)
  }
}

/**
 * Hook pour écouter un type de message spécifique
 */
export function useWebSocketMessage<T = any>(
  messageType: string,
  handler: (data: T) => void,
  deps: any[] = []
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const unsubscribe = wsService.on(messageType, (message) => {
      handlerRef.current(message as T)
    })

    return unsubscribe
  }, [messageType, ...deps])
}

/**
 * Hook pour rejoindre une room et écouter ses messages
 */
export function useRoom(roomId: string | null) {
  const [members, setMembers] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<number[]>([])

  useEffect(() => {
    if (!roomId) return

    // Rejoindre la room
    wsService.joinRoom(roomId)

    // Écouter les messages
    const unsubMessage = wsService.on('group_message', (data) => {
      if (data.message?.group_id === parseInt(roomId.replace('group_', ''))) {
        setMessages(prev => [...prev, data.message])
      }
    })

    // Écouter les membres qui rejoignent
    const unsubJoined = wsService.on('user_joined', (data) => {
      setMembers(prev => [...prev, { user_id: data.user_id, username: data.username }])
    })

    // Écouter les membres qui partent
    const unsubLeft = wsService.on('user_left', (data) => {
      setMembers(prev => prev.filter(m => m.user_id !== data.user_id))
    })

    // Écouter le typing
    const unsubTyping = wsService.on('typing', (data) => {
      if (data.is_typing) {
        setTypingUsers(prev => [...new Set([...prev, data.user_id])])
      } else {
        setTypingUsers(prev => prev.filter(id => id !== data.user_id))
      }

      // Auto-clear après 3 secondes
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== data.user_id))
      }, 3000)
    })

    return () => {
      wsService.leaveRoom(roomId)
      unsubMessage()
      unsubJoined()
      unsubLeft()
      unsubTyping()
    }
  }, [roomId])

  const sendMessage = useCallback((content: string) => {
    if (!roomId) return

    const groupId = parseInt(roomId.replace('group_', ''))
    wsService.sendGroupMessage(groupId, content)
  }, [roomId])

  const setTyping = useCallback((isTyping: boolean) => {
    if (!roomId) return
    wsService.sendTyping(roomId, isTyping)
  }, [roomId])

  return {
    members,
    messages,
    typingUsers,
    sendMessage,
    setTyping,
    clearMessages: () => setMessages([])
  }
}

/**
 * Hook pour les notifications en temps réel
 */
export function useRealTimeNotifications(onNotification: (notification: any) => void) {
  const handlerRef = useRef(onNotification)
  handlerRef.current = onNotification

  useEffect(() => {
    const unsubscribe = wsService.on('notification', (data) => {
      handlerRef.current(data.notification)
    })

    return unsubscribe
  }, [])
}

/**
 * Hook pour la présence dans une room
 */
export function usePresence(roomId: string | null) {
  const [presence, setPresence] = useState<Record<number, any>>({})
  const [onlineCount, setOnlineCount] = useState(0)

  useEffect(() => {
    if (!roomId) return

    // Écouter les mises à jour de présence
    const unsubPresence = wsService.on('presence_update', (data) => {
      setPresence(prev => ({
        ...prev,
        [data.user_id]: {
          status: data.status,
          ...data.metadata,
          updatedAt: data.timestamp
        }
      }))
    })

    // Écouter les utilisateurs qui rejoignent/partent
    const unsubJoined = wsService.on('user_joined', (data) => {
      setPresence(prev => ({
        ...prev,
        [data.user_id]: { status: 'online', username: data.username }
      }))
      setOnlineCount(prev => prev + 1)
    })

    const unsubLeft = wsService.on('user_left', (data) => {
      setPresence(prev => {
        const newPresence = { ...prev }
        delete newPresence[data.user_id]
        return newPresence
      })
      setOnlineCount(prev => Math.max(0, prev - 1))
    })

    return () => {
      unsubPresence()
      unsubJoined()
      unsubLeft()
    }
  }, [roomId])

  const updateStatus = useCallback((status: string, metadata?: Record<string, any>) => {
    if (!roomId) return
    wsService.updatePresence(roomId, status, metadata)
  }, [roomId])

  return {
    presence,
    onlineCount,
    updateStatus
  }
}

/**
 * Hook pour la collaboration en temps réel
 */
export function useCollaboration(roomId: string | null, resourceType: string, resourceId: number) {
  const [lockedBy, setLockedBy] = useState<number | null>(null)
  const [cursors, setCursors] = useState<Record<number, any>>({})
  const [lastUpdate, setLastUpdate] = useState<any>(null)

  useEffect(() => {
    if (!roomId) return

    wsService.joinRoom(roomId)

    const unsubLocked = wsService.on('resource_locked', (data) => {
      if (data.resource_type === resourceType && data.resource_id === resourceId) {
        setLockedBy(data.locked_by)
      }
    })

    const unsubUnlocked = wsService.on('resource_unlocked', (data) => {
      if (data.resource_type === resourceType && data.resource_id === resourceId) {
        setLockedBy(null)
      }
    })

    const unsubUpdated = wsService.on('resource_updated', (data) => {
      if (data.resource_type === resourceType && data.resource_id === resourceId) {
        setLastUpdate(data)
      }
    })

    const unsubCursor = wsService.on('cursor_update', (data) => {
      setCursors(prev => ({
        ...prev,
        [data.user_id]: {
          position: data.position,
          selection: data.selection
        }
      }))
    })

    return () => {
      wsService.leaveRoom(roomId)
      unsubLocked()
      unsubUnlocked()
      unsubUpdated()
      unsubCursor()
    }
  }, [roomId, resourceType, resourceId])

  const lock = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'collaboration',
      data: {
        action: 'lock',
        room_id: roomId,
        resource_type: resourceType,
        resource_id: resourceId
      }
    })
  }, [roomId, resourceType, resourceId])

  const unlock = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'collaboration',
      data: {
        action: 'unlock',
        room_id: roomId,
        resource_type: resourceType,
        resource_id: resourceId
      }
    })
  }, [roomId, resourceType, resourceId])

  const broadcastChanges = useCallback((changes: any) => {
    if (!roomId) return
    wsService.send({
      type: 'collaboration',
      data: {
        action: 'update',
        room_id: roomId,
        resource_type: resourceType,
        resource_id: resourceId,
        changes
      }
    })
  }, [roomId, resourceType, resourceId])

  const updateCursor = useCallback((position: any, selection?: any) => {
    if (!roomId) return
    wsService.send({
      type: 'collaboration',
      data: {
        action: 'cursor',
        room_id: roomId,
        position,
        selection
      }
    })
  }, [roomId])

  return {
    lockedBy,
    cursors,
    lastUpdate,
    lock,
    unlock,
    broadcastChanges,
    updateCursor
  }
}

/**
 * Hook pour les sessions d'étude en temps réel
 */
export function useStudySession(roomId: string | null) {
  const [participants, setParticipants] = useState<Record<number, any>>({})

  useEffect(() => {
    if (!roomId) return

    wsService.joinRoom(roomId)

    const unsubProgress = wsService.on('session_progress', (data) => {
      setParticipants(prev => ({
        ...prev,
        [data.user_id]: {
          progress: data.progress,
          duration: data.duration
        }
      }))
    })

    const unsubPresence = wsService.on('presence_update', (data) => {
      setParticipants(prev => ({
        ...prev,
        [data.user_id]: {
          ...prev[data.user_id],
          status: data.status,
          ...data.metadata
        }
      }))
    })

    return () => {
      wsService.leaveRoom(roomId)
      unsubProgress()
      unsubPresence()
    }
  }, [roomId])

  const startSession = useCallback((subject?: string) => {
    if (!roomId) return
    wsService.send({
      type: 'study_session',
      data: { action: 'start', room_id: roomId, subject }
    })
  }, [roomId])

  const pauseSession = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'study_session',
      data: { action: 'pause', room_id: roomId }
    })
  }, [roomId])

  const resumeSession = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'study_session',
      data: { action: 'resume', room_id: roomId }
    })
  }, [roomId])

  const endSession = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'study_session',
      data: { action: 'end', room_id: roomId }
    })
  }, [roomId])

  const updateProgress = useCallback((progress: number, duration: number) => {
    if (!roomId) return
    wsService.send({
      type: 'study_session',
      data: { action: 'update_progress', room_id: roomId, progress, duration }
    })
  }, [roomId])

  return {
    participants,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    updateProgress
  }
}

export default useWebSocket
