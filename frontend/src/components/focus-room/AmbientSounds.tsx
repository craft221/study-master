'use client'

import { useState, useRef, useEffect } from 'react'
import { Volume2, VolumeX, Cloud, Coffee, BookOpen, Music, Waves, Wind, Flame, Bird } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/contexts/LanguageContext'

interface SoundTrack {
  id: string
  nameKey: string
  icon: React.ReactNode
  url: string
  color: string
}

const AMBIENT_SOUNDS: SoundTrack[] = [
  {
    id: 'rain',
    nameKey: 'rain',
    icon: <Cloud className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'cafe',
    nameKey: 'cafe',
    icon: <Coffee className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2519/2519-preview.mp3',
    color: 'from-amber-500 to-amber-600'
  },
  {
    id: 'library',
    nameKey: 'library',
    icon: <BookOpen className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2518/2518-preview.mp3',
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    id: 'lofi',
    nameKey: 'lofi',
    icon: <Music className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2517/2517-preview.mp3',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'waves',
    nameKey: 'ocean',
    icon: <Waves className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2516/2516-preview.mp3',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    id: 'wind',
    nameKey: 'wind',
    icon: <Wind className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2520/2520-preview.mp3',
    color: 'from-gray-400 to-gray-500'
  },
  {
    id: 'fire',
    nameKey: 'fire',
    icon: <Flame className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2521/2521-preview.mp3',
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'birds',
    nameKey: 'birds',
    icon: <Bird className="h-5 w-5" />,
    url: 'https://assets.mixkit.co/active_storage/sfx/2522/2522-preview.mp3',
    color: 'from-green-400 to-green-500'
  }
]

interface AmbientSoundsProps {
  className?: string
}

export default function AmbientSounds({ className }: AmbientSoundsProps) {
  const { t } = useTranslation()
  const [activeSounds, setActiveSounds] = useState<Record<string, number>>({})
  const [masterVolume, setMasterVolume] = useState(0.5)
  const [isMuted, setIsMuted] = useState(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  useEffect(() => {
    // Initialize audio elements
    AMBIENT_SOUNDS.forEach(sound => {
      if (!audioRefs.current[sound.id]) {
        const audio = new Audio()
        audio.loop = true
        audio.volume = 0
        audioRefs.current[sound.id] = audio
      }
    })

    return () => {
      // Cleanup
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [])

  useEffect(() => {
    // Update volumes when master volume or mute changes
    Object.entries(activeSounds).forEach(([soundId, volume]) => {
      const audio = audioRefs.current[soundId]
      if (audio) {
        audio.volume = isMuted ? 0 : volume * masterVolume
      }
    })
  }, [masterVolume, isMuted, activeSounds])

  const toggleSound = (sound: SoundTrack) => {
    const audio = audioRefs.current[sound.id]
    if (!audio) return

    if (activeSounds[sound.id]) {
      // Stop sound
      audio.pause()
      audio.currentTime = 0
      setActiveSounds(prev => {
        const next = { ...prev }
        delete next[sound.id]
        return next
      })
    } else {
      // Start sound
      audio.src = sound.url
      audio.volume = isMuted ? 0 : 0.5 * masterVolume
      audio.play().catch(console.error)
      setActiveSounds(prev => ({ ...prev, [sound.id]: 0.5 }))
    }
  }

  const updateSoundVolume = (soundId: string, volume: number) => {
    const audio = audioRefs.current[soundId]
    if (audio) {
      audio.volume = isMuted ? 0 : volume * masterVolume
      setActiveSounds(prev => ({ ...prev, [soundId]: volume }))
    }
  }

  const activeCount = Object.keys(activeSounds).length

  return (
    <div className={cn("bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white">{t('ambientSounds.title')}</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
              {activeCount} {activeCount > 1 ? t('ambientSounds.actives') : t('ambientSounds.active')}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-lg hover:bg-gray-700 transition text-gray-400 hover:text-white"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Master Volume */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-700">
        <Volume2 className="h-4 w-4 text-gray-400" />
        <Slider
          value={[masterVolume * 100]}
          onValueChange={([val]) => setMasterVolume(val / 100)}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-gray-400 w-8">{Math.round(masterVolume * 100)}%</span>
      </div>

      {/* Sound Grid - 2 colonnes pour éviter le débordement de texte */}
      <div className="grid grid-cols-2 gap-2">
        {AMBIENT_SOUNDS.map(sound => {
          const isActive = !!activeSounds[sound.id]
          return (
            <button
              key={sound.id}
              onClick={() => toggleSound(sound)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg transition-all duration-300",
                isActive
                  ? `bg-gradient-to-br ${sound.color} text-white shadow-lg`
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              )}
            >
              <div className={cn(
                "flex-shrink-0 transition-transform",
                isActive && "animate-pulse"
              )}>
                {sound.icon}
              </div>
              <span className="text-xs font-medium truncate">{t(`ambientSounds.sounds.${sound.nameKey}`)}</span>
            </button>
          )
        })}
      </div>

      {/* Individual volume controls for active sounds */}
      {activeCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {Object.entries(activeSounds).map(([soundId, volume]) => {
            const sound = AMBIENT_SOUNDS.find(s => s.id === soundId)
            if (!sound) return null
            return (
              <div key={soundId} className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-lg bg-gradient-to-br",
                  sound.color
                )}>
                  {sound.icon}
                </div>
                <Slider
                  value={[volume * 100]}
                  onValueChange={([val]) => updateSoundVolume(soundId, val / 100)}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-gray-400 w-8">{Math.round(volume * 100)}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
