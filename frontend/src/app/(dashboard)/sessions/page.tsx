'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Coffee, Target, Clock, Trophy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

type SessionType = 'work' | 'short_break' | 'long_break'

export default function SessionsPage() {
  const [sessionType, setSessionType] = useState<SessionType>('work')
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const [totalToday, setTotalToday] = useState(0)
  const [subject, setSubject] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const durations = {
    work: 25 * 60,
    short_break: 5 * 60,
    long_break: 15 * 60,
  }

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSessionComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  const handleSessionComplete = async () => {
    setIsRunning(false)
    
    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play()
    }

    toast.success(`${sessionType === 'work' ? 'Pomodoro' : 'Pause'} terminé!`)

    if (sessionType === 'work') {
      setCompletedPomodoros((prev) => prev + 1)
      
      // Save session to API
      if (sessionId) {
        try {
          await api.put(`/study-sessions/${sessionId}`, {
            duration_minutes: 25,
            completed: true,
          })
        } catch (error) {
          console.error('Error saving session:', error)
        }
      }

      // Switch to break
      if ((completedPomodoros + 1) % 4 === 0) {
        setSessionType('long_break')
        setTimeLeft(durations.long_break)
      } else {
        setSessionType('short_break')
        setTimeLeft(durations.short_break)
      }
    } else {
      // Switch back to work
      setSessionType('work')
      setTimeLeft(durations.work)
    }
  }

  const startSession = async () => {
    if (sessionType === 'work' && !sessionId) {
      try {
        const response = await api.post('/study-sessions/', {
          subject_name: subject || 'Session générale',
          session_type: 'pomodoro',
          planned_duration_minutes: 25,
        })
        setSessionId(response.data.id)
      } catch (error) {
        console.error('Error starting session:', error)
      }
    }
    setIsRunning(true)
  }

  const pauseSession = () => {
    setIsRunning(false)
  }

  const resetSession = () => {
    setIsRunning(false)
    setTimeLeft(durations[sessionType])
    setSessionId(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((durations[sessionType] - timeLeft) / durations[sessionType]) * 100

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <audio ref={audioRef} src="/notification.mp3" />
      
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sessions Pomodoro</h1>
        <p className="text-gray-600">Technique de gestion du temps pour améliorer votre productivité</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-3">
            <Target className="h-6 w-6 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{completedPomodoros}</div>
          <div className="text-sm text-gray-600">Pomodoros aujourd'hui</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
            <Clock className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {Math.floor((completedPomodoros * 25) / 60)}h {(completedPomodoros * 25) % 60}m
          </div>
          <div className="text-sm text-gray-600">Temps d'étude</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <Trophy className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{totalToday}</div>
          <div className="text-sm text-gray-600">Record du jour</div>
        </div>
      </div>

      {/* Main Timer */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-12">
        {/* Session Type Selector */}
        <div className="flex justify-center space-x-2 mb-8">
          <button
            onClick={() => {
              if (!isRunning) {
                setSessionType('work')
                setTimeLeft(durations.work)
              }
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              sessionType === 'work'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={isRunning}
          >
            <Target className="h-5 w-5 inline mr-2" />
            Pomodoro
          </button>
          <button
            onClick={() => {
              if (!isRunning) {
                setSessionType('short_break')
                setTimeLeft(durations.short_break)
              }
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              sessionType === 'short_break'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={isRunning}
          >
            <Coffee className="h-5 w-5 inline mr-2" />
            Courte pause
          </button>
          <button
            onClick={() => {
              if (!isRunning) {
                setSessionType('long_break')
                setTimeLeft(durations.long_break)
              }
            }}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              sessionType === 'long_break'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={isRunning}
          >
            <Coffee className="h-5 w-5 inline mr-2" />
            Longue pause
          </button>
        </div>

        {/* Subject Input */}
        {sessionType === 'work' && !isRunning && (
          <div className="mb-8">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sur quoi travaillez-vous? (optionnel)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
            />
          </div>
        )}

        {/* Timer Display */}
        <div className="relative mb-8">
          <svg className="w-full" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={
                sessionType === 'work'
                  ? '#dc2626'
                  : sessionType === 'short_break'
                  ? '#2563eb'
                  : '#16a34a'
              }
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 90}`}
              strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl font-bold text-gray-900 mb-2">
                {formatTime(timeLeft)}
              </div>
              <div className="text-lg text-gray-600">
                {sessionType === 'work'
                  ? 'Focus'
                  : sessionType === 'short_break'
                  ? 'Courte pause'
                  : 'Longue pause'}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {!isRunning ? (
            <button
              onClick={startSession}
              className="px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold text-lg flex items-center space-x-2 shadow-lg"
            >
              <Play className="h-6 w-6" />
              <span>Démarrer</span>
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="px-8 py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition font-semibold text-lg flex items-center space-x-2 shadow-lg"
            >
              <Pause className="h-6 w-6" />
              <span>Pause</span>
            </button>
          )}
          <button
            onClick={resetSession}
            className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold text-lg flex items-center space-x-2"
          >
            <RotateCcw className="h-6 w-6" />
            <span>Réinitialiser</span>
          </button>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comment fonctionne la technique Pomodoro?</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
              1
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Travaillez 25 min</div>
              <div className="text-gray-600">Concentrez-vous sur une tâche</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
              2
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Pause 5 min</div>
              <div className="text-gray-600">Relaxez-vous brièvement</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold">
              3
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Répétez x4</div>
              <div className="text-gray-600">Complétez 4 pomodoros</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
              4
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Pause 15 min</div>
              <div className="text-gray-600">Longue pause bien méritée</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pomodoro Counter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pomodoros complétés</h3>
        <div className="flex flex-wrap gap-2">
          {[...Array(completedPomodoros)].map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold"
            >
              <Target className="h-5 w-5" />
            </div>
          ))}
          {[...Array(Math.max(0, 4 - (completedPomodoros % 4)))].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center"
            >
              <Target className="h-5 w-5 text-gray-400" />
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-3">
          {completedPomodoros % 4 === 0 && completedPomodoros > 0
            ? 'Cycle terminé! Prenez une longue pause.'
            : `${4 - (completedPomodoros % 4)} pomodoro(s) jusqu'à la longue pause`}
        </p>
      </div>
    </div>
  )
}
