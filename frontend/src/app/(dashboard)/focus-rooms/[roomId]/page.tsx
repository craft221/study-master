'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, LogOut, Loader2, Settings, Copy, Check,
  ChevronLeft, Maximize2, Minimize2, Volume2, UserPlus, Search, X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import focusRoomsService, {
  FocusRoomParticipant,
  FocusRoomActivity,
  RoomDetailResponse,
  ParticipantStatus
} from '@/services/focusRooms'
import { useTranslation } from '@/contexts/LanguageContext'

// Import new addictive components
import AmbientSounds from '@/components/focus-room/AmbientSounds'
import PomodoroTimer from '@/components/focus-room/PomodoroTimer'
import QuickReactions from '@/components/focus-room/QuickReactions'
import StreakTracker from '@/components/focus-room/StreakTracker'
import LiveLeaderboard from '@/components/focus-room/LiveLeaderboard'
import SocialPressure from '@/components/focus-room/SocialPressure'
import RandomRewards from '@/components/focus-room/RandomRewards'
import DeepWorkMode from '@/components/focus-room/DeepWorkMode'
import { useCelebrations, CelebrationEvent } from '@/components/focus-room/FocusRoomCelebrations'
import { useSpark } from '@/contexts/SparkContext'

const STATUS_CONFIG = {
  focusing: { labelKey: 'focusing', color: 'bg-green-500', textColor: 'text-green-400' },
  deep_work: { labelKey: 'deepWork', color: 'bg-purple-500', textColor: 'text-purple-400' },
  break: { labelKey: 'break', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
  idle: { labelKey: 'idle', color: 'bg-gray-400', textColor: 'text-gray-400' },
  away: { labelKey: 'away', color: 'bg-red-500', textColor: 'text-red-400' }
}

// Visual themes
const THEMES = {
  default: {
    nameKey: 'default',
    bg: 'from-gray-900 via-gray-800 to-gray-900',
    accent: 'purple'
  },
  forest: {
    nameKey: 'forest',
    bg: 'from-green-950 via-emerald-900 to-green-950',
    accent: 'emerald'
  },
  ocean: {
    nameKey: 'ocean',
    bg: 'from-blue-950 via-cyan-900 to-blue-950',
    accent: 'cyan'
  },
  sunset: {
    nameKey: 'sunset',
    bg: 'from-orange-950 via-rose-900 to-purple-950',
    accent: 'orange'
  },
  night: {
    nameKey: 'night',
    bg: 'from-indigo-950 via-purple-900 to-slate-950',
    accent: 'indigo'
  },
  cozy: {
    nameKey: 'cozy',
    bg: 'from-amber-950 via-orange-900 to-amber-950',
    accent: 'amber'
  }
}

export default function FocusRoomPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()

  // Parse roomId safely - handle undefined/null params
  const roomIdParam = params?.roomId
  const roomId = roomIdParam ? parseInt(roomIdParam as string, 10) : NaN

  const [loading, setLoading] = useState(true)
  const [room, setRoom] = useState<RoomDetailResponse | null>(null)
  const [participants, setParticipants] = useState<FocusRoomParticipant[]>([])
  const [activities, setActivities] = useState<FocusRoomActivity[]>([])
  const [myStatus, setMyStatus] = useState<ParticipantStatus>('focusing')
  const [focusMinutes, setFocusMinutes] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<keyof typeof THEMES>('default')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; fromUser: string } | null>(null)

  // Spark celebration system
  const [lastMilestone, setLastMilestone] = useState<number>(0)
  const [isFirstInRoom, setIsFirstInRoom] = useState(false)
  const [deepWorkActive, setDeepWorkActive] = useState(false)
  const { celebrate, celebrateMilestone } = useCelebrations()
  const { showMessage } = useSpark()

  // Invite user dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [allUsers, setAllUsers] = useState<Array<{ id: number; username: string; full_name: string; avatar_url: string | null; level: number }>>([])
  const [inviteMessage, setInviteMessage] = useState('')
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const hasJoinedRef = useRef(false) // Track if user has joined the room
  const focusMinutesRef = useRef(0) // Ref pour éviter les problèmes de closure
  // Note: heartbeatIntervalRef a été supprimé - on utilise httpHeartbeatRef pour le HTTP heartbeat
  const focusIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const getCurrentUserId = useCallback(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return parseInt(payload.sub)
      } catch {
        return null
      }
    }
    return null
  }, [])

  // Trigger celebration with Spark message
  const triggerCelebration = useCallback((event: CelebrationEvent) => {
    const result = celebrate(event)
    if (result?.message) {
      // Utiliser le système de messages Spark global
      showMessage('focus_room_event', {
        message_override: result.message,
        mood: result.mood || 'excited',
        animation: 'celebration'
      })
    }
  }, [celebrate, showMessage])

  // Trigger milestone celebration
  const triggerMilestoneCelebration = useCallback((minutes: number) => {
    const result = celebrateMilestone(minutes)
    if (result?.message) {
      // Utiliser le système de messages Spark global
      showMessage('focus_room_milestone', {
        message_override: result.message,
        mood: result.mood || 'excited',
        animation: 'celebration'
      })
    }
  }, [celebrateMilestone, showMessage])

  // Fetch initial room data
  useEffect(() => {
    // Don't fetch if roomId is invalid
    if (isNaN(roomId) || roomId <= 0) {
      console.error('[FocusRoom] Invalid roomId:', roomIdParam)
      toast({
        title: t('focusRoom.error'),
        description: t('focusRoom.invalidRoomId'),
        variant: 'destructive'
      })
      router.push('/focus-rooms')
      return
    }

    fetchRoomData()

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current)
    }
  }, [roomId])

  // Sauvegarder la session quand l'utilisateur quitte la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasJoinedRef.current && focusMinutesRef.current > 0) {
        // Utiliser fetch avec keepalive pour envoyer les données de manière fiable
        const token = localStorage.getItem('access_token')
        if (token) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/focus-rooms/${roomId}/leave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({}),
            keepalive: true // Important: permet d'envoyer même si la page se ferme
          }).catch(() => {}) // Ignorer les erreurs car la page se ferme
        }
        // Afficher un message de confirmation
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handleVisibilityChange = () => {
      // Sauvegarder les minutes quand l'onglet devient invisible
      if (document.visibilityState === 'hidden' && hasJoinedRef.current) {
        // Envoyer un heartbeat pour sauvegarder le temps de focus actuel
        focusRoomsService.heartbeat(roomId).catch(console.error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [roomId]) // Utilise des refs pour les autres valeurs

  // Use refs to track current values to avoid closure issues
  const myStatusRef = useRef(myStatus)
  useEffect(() => {
    myStatusRef.current = myStatus
  }, [myStatus])

  useEffect(() => {
    focusMinutesRef.current = focusMinutes
  }, [focusMinutes])

  // Focus time counter - Updates minutes every 60 seconds (not fractions)
  const secondsCounterRef = useRef(0)

  useEffect(() => {
    console.log('[FocusRoom] Starting timer interval')

    // Increment every 60 seconds to add 1 minute (not fractions)
    const intervalId = setInterval(() => {
      secondsCounterRef.current += 1

      // Only update minutes every 60 seconds
      if (secondsCounterRef.current >= 60) {
        secondsCounterRef.current = 0

        const currentStatus = myStatusRef.current

        // Update my own minutes if I'm focusing or in deep_work
        if (currentStatus === 'focusing' || currentStatus === 'deep_work') {
          setFocusMinutes(prev => Math.floor(prev) + 1)
        }

        // Also update all participants who are focusing or in deep_work
        setParticipants(prev => prev.map(p => {
          if (p.status === 'focusing' || p.status === 'deep_work') {
            return { ...p, focus_minutes: Math.floor(p.focus_minutes) + 1 }
          }
          return p
        }))
      }
    }, 1000)

    return () => {
      console.log('[FocusRoom] Clearing timer interval')
      clearInterval(intervalId)
    }
  }, []) // Empty deps - runs once on mount

  // HTTP Heartbeat - Sauvegarde périodique des minutes de focus (plus fiable que WebSocket)
  const httpHeartbeatRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Ne pas démarrer le heartbeat si roomId est invalide
    if (isNaN(roomId) || roomId <= 0) return

    const sendHeartbeat = async () => {
      // Seulement si l'utilisateur a rejoint la room
      if (!hasJoinedRef.current) return

      try {
        const result = await focusRoomsService.heartbeat(roomId)
        console.log('[FocusRoom] HTTP Heartbeat sent, focus_minutes:', result.focus_minutes, 'xp_earned:', result.xp_earned)

        // Afficher un toast si un milestone est atteint avec les XP gagnés
        if (result.milestone) {
          const xpText = result.xp_earned > 0 ? ` (+${result.xp_earned} XP)` : ''
          toast({
            title: `🎯 ${t('focusRoom.milestoneReached', { username: 'Vous', milestone: result.milestone })}${xpText}`,
            description: t('focusRoom.congrats'),
          })
        }
      } catch (error) {
        // Silently ignore heartbeat errors - ne pas spammer l'utilisateur
        console.warn('[FocusRoom] HTTP Heartbeat failed:', error)
      }
    }

    // Envoyer un heartbeat immédiatement puis toutes les 30 secondes
    // Premier heartbeat après 5 secondes pour laisser le temps de join
    const initialTimeout = setTimeout(() => {
      sendHeartbeat()
      // Puis toutes les 30 secondes
      httpHeartbeatRef.current = setInterval(sendHeartbeat, 30000)
    }, 5000)

    return () => {
      clearTimeout(initialTimeout)
      if (httpHeartbeatRef.current) {
        clearInterval(httpHeartbeatRef.current)
        httpHeartbeatRef.current = null
      }
    }
  }, [roomId]) // Dépend uniquement de roomId

  // Milestone detection - trigger celebrations when milestones are reached
  const milestones = [15, 30, 45, 60, 90, 120, 180, 240]

  useEffect(() => {
    // Check if we've crossed a new milestone
    const currentMinutes = Math.floor(focusMinutes)

    // Find the highest milestone we've passed
    for (const milestone of milestones) {
      if (currentMinutes >= milestone && lastMilestone < milestone) {
        setLastMilestone(milestone)
        triggerMilestoneCelebration(milestone)
        break
      }
    }
  }, [focusMinutes, lastMilestone, triggerMilestoneCelebration])

  // Check if first in room - celebrate!
  useEffect(() => {
    if (participants.length === 1 && !isFirstInRoom && hasJoinedRef.current) {
      setIsFirstInRoom(true)
      triggerCelebration('first_in_room')
    }
  }, [participants.length, isFirstInRoom, triggerCelebration])

  const fetchRoomData = async () => {
    try {
      setLoading(true)
      let data = await focusRoomsService.getRoom(roomId)
      setRoom(data)

      const currentUserId = getCurrentUserId()
      let me = data.participants?.find((p: FocusRoomParticipant) => p.user_id === currentUserId)

      // Auto-join si l'utilisateur n'est pas encore participant
      if (!me) {
        hasJoinedRef.current = false
        console.log('[FocusRoom] User not in participants, auto-joining...')
        try {
          await focusRoomsService.joinRoom(roomId)
          // Re-fetch room data after joining
          data = await focusRoomsService.getRoom(roomId)
          setRoom(data)
          me = data.participants?.find((p: FocusRoomParticipant) => p.user_id === currentUserId)
          console.log('[FocusRoom] Auto-join successful')
          hasJoinedRef.current = true
        } catch (joinError: any) {
          console.error('[FocusRoom] Auto-join failed:', joinError)
          // Si c'est une room privée ou pleine, rediriger
          if (joinError.response?.status === 403 || joinError.response?.status === 400) {
            toast({
              title: t('focusRoom.error'),
              description: joinError.response?.data?.detail || t('focusRoom.joinError'),
              variant: 'destructive'
            })
            router.push('/focus-rooms')
            return
          }
        }
      } else {
        // L'utilisateur était déjà participant
        hasJoinedRef.current = true
      }

      // Initialiser les minutes depuis le backend
      const myMinutes = me?.focus_minutes || 0
      console.log('[FocusRoom] Fetched data - my minutes from backend:', myMinutes, 'my status:', me?.status)

      // Mettre à jour les participants en conservant le maximum de minutes
      // (pour éviter de perdre les updates du timer)
      setParticipants(prev => {
        const newParticipants = data.participants || []
        // Si c'est le premier chargement (prev est vide), utiliser les données du backend
        if (prev.length === 0) {
          // S'assurer que les minutes sont des entiers
          return newParticipants.map((p: FocusRoomParticipant) => ({
            ...p,
            focus_minutes: Math.floor(p.focus_minutes)
          }))
        }
        // Sinon, merger en gardant le max de minutes pour chaque participant
        return newParticipants.map((newP: FocusRoomParticipant) => {
          const existingP = prev.find(p => p.user_id === newP.user_id)
          if (existingP) {
            return {
              ...newP,
              focus_minutes: Math.floor(Math.max(existingP.focus_minutes, newP.focus_minutes))
            }
          }
          return { ...newP, focus_minutes: Math.floor(newP.focus_minutes) }
        })
      })
      setActivities(data.recent_activities || [])

      if (me) {
        setMyStatus(me.status)
        // Conserver le max entre les minutes actuelles et celles du backend (toujours entier)
        setFocusMinutes(prev => Math.floor(Math.max(prev, myMinutes)))
      }

      connectWebSocket()
    } catch (error: any) {
      console.error('Error fetching room:', error)
      toast({
        title: t('focusRoom.error'),
        description: t('focusRoom.loadError'),
        variant: 'destructive'
      })
      router.push('/focus-rooms')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    // Essayer access_token d'abord, puis token comme fallback
    const token = localStorage.getItem('access_token') || localStorage.getItem('token')
    if (!token) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
    const ws = new WebSocket(`${wsUrl}/api/v1/ws/focus-room/${roomId}?token=${token}`)

    ws.onopen = () => {
      setIsConnected(true)
      // NOTE: Ne pas envoyer de heartbeat WebSocket ici
      // On utilise exclusivement le HTTP heartbeat (useEffect plus haut)
      // pour éviter le double comptage des minutes de focus
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleWSMessage(message)
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    wsRef.current = ws
  }

  const handleWSMessage = (message: any) => {
    switch (message.type) {
      case 'room_state':
        // Merger avec les données existantes en gardant le max de minutes (toujours entier)
        setParticipants(prev => {
          const newParticipants = message.participants || []
          if (prev.length === 0) {
            return newParticipants.map((p: FocusRoomParticipant) => ({
              ...p,
              focus_minutes: Math.floor(p.focus_minutes)
            }))
          }
          return newParticipants.map((newP: FocusRoomParticipant) => {
            const existingP = prev.find(p => p.user_id === newP.user_id)
            if (existingP) {
              return {
                ...newP,
                focus_minutes: Math.floor(Math.max(existingP.focus_minutes, newP.focus_minutes))
              }
            }
            return { ...newP, focus_minutes: Math.floor(newP.focus_minutes) }
          })
        })
        break

      case 'user_joined':
        setParticipants(prev => {
          if (prev.find(p => p.user_id === message.user_id)) return prev
          return [...prev, {
            id: 0,
            user_id: message.user_id,
            room_id: roomId,
            username: message.username,
            avatar_url: message.avatar_url,
            level: message.level,
            status: 'focusing' as ParticipantStatus,
            current_activity: null,
            current_subject_name: null,
            joined_at: message.timestamp,
            focus_minutes: Math.floor(message.focus_minutes || 0),
            today_focus_minutes: Math.floor(message.today_focus_minutes || 0),
            milestones_reached: [],
            is_visible: true
          }]
        })
        toast({
          title: t('focusRoom.userJoined', { username: message.username }),
          description: t('focusRoom.newFocusBuddy'),
        })
        // Celebrate new user joining!
        triggerCelebration('user_joined')
        break

      case 'user_left':
        setParticipants(prev => prev.filter(p => p.user_id !== message.user_id))
        break

      case 'status_changed':
        // Garder le max de minutes entre l'existant et le serveur (toujours entier)
        setParticipants(prev => prev.map(p =>
          p.user_id === message.user_id
            ? { ...p, status: message.new_status, focus_minutes: Math.floor(Math.max(p.focus_minutes, message.focus_minutes || 0)) }
            : p
        ))
        break

      case 'reaction':
        setIncomingReaction({
          emoji: message.emoji,
          fromUser: message.from_username
        })
        setTimeout(() => setIncomingReaction(null), 100)
        break

      case 'milestone_reached':
        toast({
          title: t('focusRoom.milestoneReached', { username: message.username, milestone: message.milestone }),
          description: t('focusRoom.congrats'),
        })
        break

      case 'focus_time_update':
        // Mettre à jour le temps de focus d'un participant (garder le max, toujours entier)
        setParticipants(prev => prev.map(p =>
          p.user_id === message.user_id
            ? { ...p, focus_minutes: Math.floor(Math.max(p.focus_minutes, message.focus_minutes || 0)) }
            : p
        ))
        break
    }
  }

  const handleStatusChange = async (newStatus: ParticipantStatus) => {
    try {
      await focusRoomsService.updateStatus(roomId, newStatus)
      setMyStatus(newStatus)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'status_update', status: newStatus }))
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleReaction = (emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', emoji }))
    }
  }

  const handleLeaveRoom = async () => {
    try {
      const result = await focusRoomsService.leaveRoom(roomId)
      toast({
        title: t('focusRoom.sessionEnded'),
        description: t('focusRoom.xpEarned', { xp: result.xp_earned }),
      })
    } catch (error: any) {
      console.error('Error leaving room:', error)
      // Si l'erreur est "not in room", c'est OK - l'utilisateur n'était pas vraiment dans la room
      if (error.response?.status === 400) {
        toast({
          title: t('focusRoom.sessionEnded'),
          description: t('focusRoom.alreadyLeft') || 'Session terminée',
        })
      }
    }
    // Toujours rediriger, même en cas d'erreur
    router.push('/focus-rooms')
  }

  const copyInviteCode = () => {
    if (room?.invite_code) {
      navigator.clipboard.writeText(room.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openInviteDialog = async () => {
    setInviteDialogOpen(true)
    setSearchQuery('')
    setInviteMessage('')
    try {
      const response = await api.get('/users/')
      setAllUsers(response.data.filter((u: any) => u.id !== getCurrentUserId()))
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleInviteUser = async (userId: number) => {
    try {
      setInvitingUserId(userId)
      await focusRoomsService.inviteUser(roomId, userId, inviteMessage || undefined)
      toast({
        title: t('focusRoom.invitationSent'),
        description: t('focusRoom.invitationSentDesc'),
      })
      setInviteDialogOpen(false)
    } catch (error: any) {
      console.error('Error inviting user:', error)
      const errorMessage = error.response?.data?.detail || t('focusRoom.invitationError')
      toast({
        title: t('focusRoom.error'),
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setInvitingUserId(null)
    }
  }

  const filteredUsers = allUsers.filter(user => {
    const query = searchQuery.toLowerCase()
    return user.username.toLowerCase().includes(query) ||
           (user.full_name && user.full_name.toLowerCase().includes(query))
  }).filter(user => !participants.some(p => p.user_id === user.id))

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-4">{t('focusRoom.roomNotFound')}</h2>
          <Link href="/focus-rooms">
            <Button>{t('focusRoom.backToRooms')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const theme = THEMES[currentTheme]
  const focusingParticipants = participants.filter(p => p.status === 'focusing' || p.status === 'deep_work')

  // Récupérer les minutes de l'utilisateur courant depuis la liste des participants
  // pour éviter la désynchronisation entre focusMinutes et participants[me].focus_minutes
  const currentUserId = getCurrentUserId()
  const myParticipant = participants.find(p => p.user_id === currentUserId)
  const myActualMinutes = myParticipant ? myParticipant.focus_minutes : focusMinutes

  const roomAverage = participants.length > 0
    ? Math.round(participants.reduce((sum, p) => sum + p.focus_minutes, 0) / participants.length)
    : 0

  const leaderboardEntries = [...participants]
    .sort((a, b) => b.focus_minutes - a.focus_minutes)
    .map((p, i) => ({
      rank: i + 1,
      userId: p.user_id,
      username: p.username,
      avatarUrl: p.avatar_url || undefined,
      focusMinutes: p.focus_minutes,
      isOnline: true,
      isFocusing: p.status === 'focusing' || p.status === 'deep_work'
    }))

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.bg} transition-all duration-1000`}>
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/5 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Top Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/focus-rooms">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-xl sm:text-3xl flex-shrink-0">{room.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-sm sm:text-lg font-bold text-white truncate max-w-[100px] sm:max-w-none">{room.name}</h1>
                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                </div>
                <p className="text-[10px] sm:text-xs text-white/60">{participants.length} {t('focusRoom.participants')}</p>
              </div>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {/* Invite Friend Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={openInviteDialog}
              className="text-white/70 hover:text-white gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t('focusRoom.inviteFriend')}
            </Button>

            {room.invite_code && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyInviteCode}
                className="text-white/70 hover:text-white"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {room.invite_code}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/70 hover:text-white"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleLeaveRoom}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('focusRoom.leave')}
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={openInviteDialog}
              className="text-white/70 hover:text-white h-8 w-8"
            >
              <UserPlus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/70 hover:text-white h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleLeaveRoom}
              className="h-8 px-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed top-12 sm:top-16 right-2 sm:right-4 z-50 bg-gray-900/95 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 w-56 sm:w-64">
          <h3 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-3">{t('focusRoom.visualTheme')}</h3>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {Object.entries(THEMES).map(([key, themeItem]) => (
              <button
                key={key}
                onClick={() => setCurrentTheme(key as keyof typeof THEMES)}
                className={`p-1.5 sm:p-2 rounded-lg text-[10px] sm:text-xs transition ${
                  currentTheme === key
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t(`focusRoom.themes.${themeItem.nameKey}`)}
              </button>
            ))}
          </div>

          {/* Mobile: Show invite code here */}
          {room.invite_code && (
            <div className="mt-3 pt-3 border-t border-white/10 md:hidden">
              <p className="text-[10px] text-white/60 mb-1.5">{t('focusRoom.inviteCode')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={copyInviteCode}
                className="w-full text-white/80 border-white/20 text-xs h-8"
              >
                {copied ? <Check className="h-3 w-3 mr-1.5" /> : <Copy className="h-3 w-3 mr-1.5" />}
                {room.invite_code}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-2 sm:p-4 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6">
        {/* Left Sidebar - Social Pressure & Leaderboard */}
        <aside className="lg:col-span-3 space-y-3 sm:space-y-4">
          {/* Mobile: Horizontal scroll for stats */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory">
            <div className="snap-start flex-shrink-0 w-[85%] sm:w-auto sm:flex-1">
              <SocialPressure
                viewerCount={participants.length}
                focusingCount={focusingParticipants.length}
                myFocusMinutes={Math.round(myActualMinutes)}
                roomAverage={roomAverage}
                myRank={leaderboardEntries.find(e => e.userId === currentUserId)?.rank}
                totalParticipants={participants.length}
              />
            </div>
            <div className="snap-start flex-shrink-0 w-[85%] sm:w-auto sm:flex-1">
              <LiveLeaderboard
                entries={leaderboardEntries}
                currentUserId={getCurrentUserId() || undefined}
              />
            </div>
          </div>

          {/* Desktop: Normal stack */}
          <div className="hidden lg:block">
            <SocialPressure
              viewerCount={participants.length}
              focusingCount={focusingParticipants.length}
              myFocusMinutes={Math.round(myActualMinutes)}
              roomAverage={roomAverage}
              myRank={leaderboardEntries.find(e => e.userId === currentUserId)?.rank}
              totalParticipants={participants.length}
            />
          </div>

          <div className="hidden lg:block">
            <LiveLeaderboard
              entries={leaderboardEntries}
              currentUserId={getCurrentUserId() || undefined}
            />
          </div>
        </aside>

        {/* Center - Main Focus Area */}
        <div className="lg:col-span-6 space-y-3 sm:space-y-6">
          {/* Pomodoro Timer */}
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardContent className="p-4 sm:p-8">
              <PomodoroTimer
                onStatusChange={(status) => handleStatusChange(status === 'focusing' ? 'focusing' : 'break')}
                onComplete={(type) => {
                  if (type === 'focus') {
                    toast({
                      title: t('focusRoom.pomodoroComplete'),
                      description: t('focusRoom.takeBreak'),
                    })
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Deep Work Mode */}
          <DeepWorkMode
            roomId={roomId}
            onStart={() => {
              handleStatusChange('focusing')
              setDeepWorkActive(true)
              toast({
                title: t('focusRoom.deepWorkActivated'),
                description: t('focusRoom.notificationsBlocked'),
              })
              triggerCelebration('deep_work_started')
            }}
            onEnd={(completed) => {
              setDeepWorkActive(false)
              if (completed) {
                toast({
                  title: t('focusRoom.deepWorkEnded'),
                  description: t('focusRoom.bonusXp'),
                })
                triggerCelebration('deep_work_completed')
              }
            }}
          />

          {/* Streak Tracker */}
          <StreakTracker
            focusMinutes={Math.round(myActualMinutes)}
            isActive={myStatus === 'focusing' || myStatus === 'deep_work'}
            onMilestone={(milestone) => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'milestone', milestone }))
              }
            }}
          />

          {/* Quick Reactions Bar */}
          <div className="flex justify-center">
            <QuickReactions
              onReact={handleReaction}
              incomingReaction={incomingReaction}
            />
          </div>
        </div>

        {/* Right Sidebar - Ambiance & Participants */}
        <aside className="lg:col-span-3 space-y-3 sm:space-y-4">
          {/* Mobile: Grid layout for smaller components */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:hidden">
            <div className="col-span-1">
              <AmbientSounds />
            </div>
            <div className="col-span-1">
              <RandomRewards
                isActive={myStatus === 'focusing' || myStatus === 'deep_work'}
                focusMinutes={Math.round(myActualMinutes)}
                onRewardClaimed={async (reward) => {
                  try {
                    const result = await focusRoomsService.claimReward(roomId, reward.type, reward.rarity)
                    toast({
                      title: `${reward.emoji} ${reward.name}`,
                      description: `${reward.description} (+${result.xp_earned} XP)`,
                    })
                    triggerCelebration('reward_claimed')
                  } catch (error) {
                    console.error('Error claiming reward:', error)
                    toast({
                      title: `${reward.emoji} ${reward.name}`,
                      description: reward.description,
                    })
                    triggerCelebration('reward_claimed')
                  }
                }}
              />
            </div>
          </div>

          {/* Desktop: Normal layout */}
          <div className="hidden lg:block">
            <AmbientSounds />
          </div>

          <div className="hidden lg:block">
            <RandomRewards
              isActive={myStatus === 'focusing' || myStatus === 'deep_work'}
              focusMinutes={Math.round(myActualMinutes)}
              onRewardClaimed={async (reward) => {
                try {
                  const result = await focusRoomsService.claimReward(roomId, reward.type, reward.rarity)
                  toast({
                    title: `${reward.emoji} ${reward.name}`,
                    description: `${reward.description} (+${result.xp_earned} XP)`,
                  })
                  triggerCelebration('reward_claimed')
                } catch (error) {
                  console.error('Error claiming reward:', error)
                  toast({
                    title: `${reward.emoji} ${reward.name}`,
                    description: reward.description,
                  })
                  triggerCelebration('reward_claimed')
                }
              }}
            />
          </div>

          {/* Participants List */}
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center justify-between text-white">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {t('focusRoom.online')}
                </span>
                <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-[10px] sm:text-xs px-1.5 sm:px-2">
                  {focusingParticipants.length} {t('focusRoom.status.focusing')}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-48 sm:max-h-64 overflow-y-auto px-3 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                {participants.map((p) => (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-white/5 transition"
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8 border border-white/10">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback className="bg-gray-700 text-white text-[10px] sm:text-xs">
                          {p.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-gray-900 ${STATUS_CONFIG[p.status].color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-white truncate">
                        {p.username}
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/50">
                        {p.focus_minutes} min
                      </p>
                    </div>
                    {p.milestones_reached && p.milestones_reached.length > 0 && (
                      <span className="text-xs sm:text-sm">
                        {p.milestones_reached[p.milestones_reached.length - 1] === '3h' ? '🏆' :
                         p.milestones_reached[p.milestones_reached.length - 1] === '2h' ? '💫' :
                         p.milestones_reached[p.milestones_reached.length - 1] === '1h' ? '⭐' : '🌟'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>

      {/* XP Bonus Banner */}
      <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 w-[90%] sm:w-auto max-w-sm">
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-500/30 rounded-full px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2">
          <span className="text-sm sm:text-lg">⚡</span>
          <span className="text-xs sm:text-sm font-medium text-purple-300 truncate">
            {t('focusRoom.xpBonusActive')}
          </span>
          <span className="text-sm sm:text-lg">⚡</span>
        </div>
      </div>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md mx-2 sm:mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              {t('focusRoom.inviteFriendTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t('focusRoom.inviteFriendDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('focusRoom.searchUser')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm sm:text-base"
              />
            </div>

            {/* Optional message */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="invite_message" className="text-xs sm:text-sm">{t('focusRoom.inviteMessage')} ({t('common.optional')})</Label>
              <Input
                id="invite_message"
                placeholder={t('focusRoom.inviteMessagePlaceholder')}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="text-sm sm:text-base"
              />
            </div>

            {/* Users list */}
            <div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-1.5 sm:space-y-2 border rounded-lg p-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm">
                  {searchQuery ? t('focusRoom.noUserFound') : t('focusRoom.typeToSearch')}
                </p>
              ) : (
                filteredUsers.slice(0, 20).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-gray-50 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs sm:text-sm">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{user.username}</p>
                        {user.full_name && (
                          <p className="text-xs sm:text-sm text-gray-500 truncate">{user.full_name}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleInviteUser(user.id)}
                      disabled={invitingUserId === user.id}
                      className="flex-shrink-0 h-7 sm:h-8 text-xs sm:text-sm"
                    >
                      {invitingUserId === user.id ? (
                        <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      ) : (
                        t('focusRoom.invite')
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="w-full sm:w-auto">
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
  )
}
