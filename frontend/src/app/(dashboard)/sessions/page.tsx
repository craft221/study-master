'use client'

import { useEffect } from 'react'
import { Play, Pause, RotateCcw, Coffee, Target, Clock, Trophy, Square, CloudOff } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePomodoro, SessionType } from '@/contexts/PomodoroContext'
import { useOfflineContext } from '@/components/providers/OfflineProvider'

export default function SessionsPage() {
  const { t } = useLanguage()
  const { isOnline } = useOfflineContext()
  const {
    state,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    stopSession,
    setSessionType,
    setSubject,
    formatTime,
    getProgress,
    durations,
  } = usePomodoro()

  const progress = getProgress()

  // Session type buttons config
  const sessionTypes: { type: SessionType; icon: typeof Target; colorClass: string }[] = [
    { type: 'work', icon: Target, colorClass: 'bg-red-600' },
    { type: 'short_break', icon: Coffee, colorClass: 'bg-blue-600' },
    { type: 'long_break', icon: Coffee, colorClass: 'bg-green-600' },
  ]

  const getSessionLabel = (type: SessionType) => {
    switch (type) {
      case 'work': return t('sessionsPage.pomodoro')
      case 'short_break': return t('sessionsPage.shortBreak')
      case 'long_break': return t('sessionsPage.longBreak')
    }
  }

  const getSessionColor = () => {
    switch (state.sessionType) {
      case 'work': return '#dc2626'
      case 'short_break': return '#2563eb'
      case 'long_break': return '#16a34a'
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                {t('sessionsPage.offlineMode') || 'Mode hors ligne'}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {t('sessionsPage.offlineSaveMessage') || 'Vos sessions seront synchronisées automatiquement lorsque vous serez en ligne.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('sessionsPage.title')}</h1>
          {!isOnline && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <CloudOff className="w-3 h-3 mr-1" />
              Offline
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">{t('sessionsPage.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-3">
            <Target className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{state.completedPomodoros}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.pomodorosToday')}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {Math.floor(state.totalMinutesToday / 60)}h {state.totalMinutesToday % 60}m
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.studyTime')}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
            <Trophy className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{state.totalMinutesToday} min</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.dayRecord')}</div>
        </div>
      </div>

      {/* Main Timer */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-12">
        {/* Session Type Selector */}
        <div className="flex justify-center space-x-2 mb-8">
          {sessionTypes.map(({ type, icon: Icon, colorClass }) => (
            <button
              key={type}
              onClick={() => setSessionType(type)}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                state.sessionType === type
                  ? `${colorClass} text-white`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              disabled={state.isRunning}
            >
              <Icon className="h-5 w-5 inline mr-2" />
              {getSessionLabel(type)}
            </button>
          ))}
        </div>

        {/* Subject Input */}
        {state.sessionType === 'work' && !state.isRunning && (
          <div className="mb-8">
            <input
              type="text"
              value={state.subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('sessionsPage.workingOn')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
            />
          </div>
        )}

        {/* Current Subject Display */}
        {state.subject && state.isRunning && (
          <div className="text-center mb-4">
            <span className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
              {state.subject}
            </span>
          </div>
        )}

        {/* Timer Display */}
        <div className="relative mb-8">
          <svg className="w-full max-w-md mx-auto" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={getSessionColor()}
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
              <div className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
                {formatTime(state.timeLeft)}
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400">
                {state.isPaused ? (
                  <span className="text-orange-500 font-medium">EN PAUSE</span>
                ) : (
                  getSessionLabel(state.sessionType)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {!state.isRunning ? (
            <button
              onClick={() => startSession(undefined, true)}
              className="px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold text-lg flex items-center space-x-2 shadow-lg"
            >
              <Play className="h-6 w-6" />
              <span>{t('sessionsPage.start')}</span>
            </button>
          ) : state.isPaused ? (
            <button
              onClick={resumeSession}
              className="px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold text-lg flex items-center space-x-2 shadow-lg"
            >
              <Play className="h-6 w-6" />
              <span>{t('sessionsPage.resume') || 'Reprendre'}</span>
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="px-8 py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition font-semibold text-lg flex items-center space-x-2 shadow-lg"
            >
              <Pause className="h-6 w-6" />
              <span>{t('sessionsPage.pause')}</span>
            </button>
          )}

          {state.isRunning && (
            <button
              onClick={stopSession}
              className="px-8 py-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition font-semibold text-lg flex items-center space-x-2"
            >
              <Square className="h-6 w-6" />
              <span>{t('sessionsPage.stop') || 'Arrêter'}</span>
            </button>
          )}

          <button
            onClick={resetSession}
            className="px-8 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition font-semibold text-lg flex items-center space-x-2"
          >
            <RotateCcw className="h-6 w-6" />
            <span>{t('sessionsPage.reset')}</span>
          </button>
        </div>

        {/* Persistence indicator */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isOnline
              ? (t('sessionsPage.timerPersistence') || 'Le timer continue même si vous changez de page')
              : (t('sessionsPage.offlineTimerPersistence') || 'Mode offline activé - vos sessions seront synchronisées automatiquement')
            }
          </p>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('sessionsPage.howItWorks')}</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
              1
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">{t('sessionsPage.step1Title')}</div>
              <div className="text-gray-600 dark:text-gray-400">{t('sessionsPage.step1Desc')}</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              2
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">{t('sessionsPage.step2Title')}</div>
              <div className="text-gray-600 dark:text-gray-400">{t('sessionsPage.step2Desc')}</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
              3
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">{t('sessionsPage.step3Title')}</div>
              <div className="text-gray-600 dark:text-gray-400">{t('sessionsPage.step3Desc')}</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 font-bold">
              4
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">{t('sessionsPage.step4Title')}</div>
              <div className="text-gray-600 dark:text-gray-400">{t('sessionsPage.step4Desc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pomodoro Counter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('sessionsPage.completedPomodoros')}</h3>
        <div className="flex flex-wrap gap-2">
          {[...Array(state.completedPomodoros)].map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold"
            >
              <Target className="h-5 w-5" />
            </div>
          ))}
          {[...Array(Math.max(0, 4 - (state.completedPomodoros % 4)))].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center"
            >
              <Target className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
          {state.completedPomodoros % 4 === 0 && state.completedPomodoros > 0
            ? t('sessionsPage.cycleComplete')
            : t('sessionsPage.untilLongBreak', { count: 4 - (state.completedPomodoros % 4) })}
        </p>
      </div>
    </div>
  )
}
