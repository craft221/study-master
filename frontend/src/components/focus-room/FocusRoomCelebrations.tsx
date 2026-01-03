'use client'

import { useEffect, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useLanguage } from '@/contexts/LanguageContext'

// Types d'événements qui déclenchent des célébrations
export type CelebrationEvent =
  | 'milestone_15min'
  | 'milestone_30min'
  | 'milestone_45min'
  | 'milestone_1h'
  | 'milestone_90min'
  | 'milestone_2h'
  | 'milestone_3h'
  | 'milestone_4h'
  | 'user_joined'
  | 'deep_work_started'
  | 'deep_work_completed'
  | 'reward_claimed'
  | 'first_in_room'
  | 'room_goal_reached'

// Configuration des célébrations par événement (sans messages - ils sont traduits)
const CELEBRATION_CONFIG: Record<CelebrationEvent, {
  confetti: 'small' | 'medium' | 'large' | 'epic' | 'legendary' | 'none'
  sound: 'pop' | 'success' | 'fanfare' | 'epic' | 'legendary' | 'none'
  sparkMood: string
}> = {
  milestone_15min: {
    confetti: 'small',
    sound: 'pop',
    sparkMood: 'happy'
  },
  milestone_30min: {
    confetti: 'medium',
    sound: 'success',
    sparkMood: 'excited'
  },
  milestone_45min: {
    confetti: 'medium',
    sound: 'success',
    sparkMood: 'proud'
  },
  milestone_1h: {
    confetti: 'large',
    sound: 'fanfare',
    sparkMood: 'excited'
  },
  milestone_90min: {
    confetti: 'large',
    sound: 'fanfare',
    sparkMood: 'proud'
  },
  milestone_2h: {
    confetti: 'epic',
    sound: 'epic',
    sparkMood: 'excited'
  },
  milestone_3h: {
    confetti: 'legendary',
    sound: 'legendary',
    sparkMood: 'excited'
  },
  milestone_4h: {
    confetti: 'legendary',
    sound: 'legendary',
    sparkMood: 'excited'
  },
  user_joined: {
    confetti: 'none',
    sound: 'pop',
    sparkMood: 'happy'
  },
  deep_work_started: {
    confetti: 'small',
    sound: 'pop',
    sparkMood: 'thinking'
  },
  deep_work_completed: {
    confetti: 'epic',
    sound: 'epic',
    sparkMood: 'excited'
  },
  reward_claimed: {
    confetti: 'medium',
    sound: 'success',
    sparkMood: 'happy'
  },
  first_in_room: {
    confetti: 'small',
    sound: 'success',
    sparkMood: 'proud'
  },
  room_goal_reached: {
    confetti: 'legendary',
    sound: 'legendary',
    sparkMood: 'excited'
  }
}

// URLs des sons (sons gratuits et courts)
const SOUND_URLS: Record<string, string> = {
  pop: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Pop léger
  success: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', // Success
  fanfare: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3', // Achievement
  epic: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Epic win
  legendary: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', // Legendary
}

// Hook pour les célébrations
export function useCelebrations() {
  const { t } = useLanguage()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastCelebrationRef = useRef<string>('')

  // Initialiser l'élément audio
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.volume = 0.5

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Jouer un son
  const playSound = useCallback((soundType: string) => {
    if (soundType === 'none' || !audioRef.current) return

    const url = SOUND_URLS[soundType]
    if (!url) return

    try {
      audioRef.current.src = url
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Ignorer les erreurs de lecture auto (restrictions navigateur)
      })
    } catch {
      // Ignorer les erreurs
    }
  }, [])

  // Lancer les confettis selon l'intensité
  const launchConfetti = useCallback((intensity: string) => {
    if (intensity === 'none') return

    const baseConfig = {
      origin: { y: 0.7 },
      zIndex: 9999,
    }

    switch (intensity) {
      case 'small':
        confetti({
          ...baseConfig,
          particleCount: 30,
          spread: 50,
          startVelocity: 25,
        })
        break

      case 'medium':
        confetti({
          ...baseConfig,
          particleCount: 60,
          spread: 70,
          startVelocity: 30,
        })
        break

      case 'large':
        // Double burst
        confetti({
          ...baseConfig,
          particleCount: 80,
          spread: 100,
          startVelocity: 35,
          origin: { x: 0.3, y: 0.7 }
        })
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 80,
            spread: 100,
            startVelocity: 35,
            origin: { x: 0.7, y: 0.7 }
          })
        }, 150)
        break

      case 'epic':
        // Triple burst avec étoiles
        const epicColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']

        confetti({
          ...baseConfig,
          particleCount: 100,
          spread: 120,
          startVelocity: 40,
          colors: epicColors,
          origin: { x: 0.5, y: 0.6 }
        })

        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 50,
            spread: 60,
            startVelocity: 45,
            colors: epicColors,
            origin: { x: 0.2, y: 0.7 }
          })
          confetti({
            ...baseConfig,
            particleCount: 50,
            spread: 60,
            startVelocity: 45,
            colors: epicColors,
            origin: { x: 0.8, y: 0.7 }
          })
        }, 200)

        // Étoiles qui tombent
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 30,
            spread: 180,
            startVelocity: 15,
            gravity: 0.5,
            shapes: ['star'],
            colors: ['#FFD700', '#FFA500'],
            origin: { x: 0.5, y: 0.3 }
          })
        }, 400)
        break

      case 'legendary':
        // Full screen celebration avec plusieurs vagues
        const legendaryColors = ['#FFD700', '#FF1493', '#00BFFF', '#7B68EE', '#32CD32', '#FF4500']

        // Vague 1 - Centre
        confetti({
          ...baseConfig,
          particleCount: 150,
          spread: 180,
          startVelocity: 50,
          colors: legendaryColors,
          origin: { x: 0.5, y: 0.5 }
        })

        // Vague 2 - Côtés
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 100,
            spread: 90,
            startVelocity: 55,
            colors: legendaryColors,
            origin: { x: 0.1, y: 0.6 }
          })
          confetti({
            ...baseConfig,
            particleCount: 100,
            spread: 90,
            startVelocity: 55,
            colors: legendaryColors,
            origin: { x: 0.9, y: 0.6 }
          })
        }, 200)

        // Vague 3 - Pluie d'étoiles
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 50,
            spread: 360,
            startVelocity: 20,
            gravity: 0.3,
            ticks: 300,
            shapes: ['star'],
            colors: ['#FFD700', '#FFA500', '#FF69B4'],
            origin: { x: 0.5, y: 0.2 }
          })
        }, 400)

        // Vague 4 - Encore plus
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 80,
            spread: 150,
            startVelocity: 45,
            colors: legendaryColors,
            origin: { x: 0.3, y: 0.4 }
          })
          confetti({
            ...baseConfig,
            particleCount: 80,
            spread: 150,
            startVelocity: 45,
            colors: legendaryColors,
            origin: { x: 0.7, y: 0.4 }
          })
        }, 600)

        // Vague finale
        setTimeout(() => {
          confetti({
            ...baseConfig,
            particleCount: 200,
            spread: 180,
            startVelocity: 60,
            colors: legendaryColors,
            gravity: 0.8,
            origin: { x: 0.5, y: 0.7 }
          })
        }, 800)
        break
    }
  }, [])

  // Fonction principale de célébration
  const celebrate = useCallback((event: CelebrationEvent) => {
    // Éviter les doubles célébrations trop rapprochées
    const now = Date.now()
    const key = `${event}_${now}`
    if (lastCelebrationRef.current === event) {
      return null
    }
    lastCelebrationRef.current = event
    setTimeout(() => {
      if (lastCelebrationRef.current === event) {
        lastCelebrationRef.current = ''
      }
    }, 2000)

    const config = CELEBRATION_CONFIG[event]
    if (!config) return null

    // Lancer les confettis
    launchConfetti(config.confetti)

    // Jouer le son
    playSound(config.sound)

    // Récupérer le message traduit
    const translatedMessage = t(`sparkWidget.automaticMessages.focus_room.${event}`)

    // Retourner le message Spark pour l'afficher
    return {
      message: translatedMessage,
      mood: config.sparkMood
    }
  }, [launchConfetti, playSound, t])

  // Célébration pour milestone basé sur les minutes
  const celebrateMilestone = useCallback((minutes: number) => {
    const milestoneMap: Record<number, CelebrationEvent> = {
      15: 'milestone_15min',
      30: 'milestone_30min',
      45: 'milestone_45min',
      60: 'milestone_1h',
      90: 'milestone_90min',
      120: 'milestone_2h',
      180: 'milestone_3h',
      240: 'milestone_4h'
    }

    const event = milestoneMap[minutes]
    if (event) {
      return celebrate(event)
    }
    return null
  }, [celebrate])

  return {
    celebrate,
    celebrateMilestone,
    launchConfetti,
    playSound
  }
}

// Composant pour les messages de Spark dans la room
interface SparkRoomMessageProps {
  message: string
  mood?: string
  onClose?: () => void
}

export function SparkRoomMessage({ message, mood = 'happy', onClose }: SparkRoomMessageProps) {
  useEffect(() => {
    // Auto-fermer après 4 secondes
    const timer = setTimeout(() => {
      onClose?.()
    }, 4000)

    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="fixed bottom-32 right-8 z-[100] animate-bounce-in">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-2xl shadow-2xl max-w-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl">
            {mood === 'excited' ? '🤩' :
             mood === 'proud' ? '😊' :
             mood === 'thinking' ? '🤔' :
             mood === 'happy' ? '😄' : '⚡'}
          </span>
          <div>
            <p className="font-bold text-sm mb-1">Spark</p>
            <p className="text-sm">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default useCelebrations
