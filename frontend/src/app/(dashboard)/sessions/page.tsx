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
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-0 space-y-4 sm:space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <CloudOff className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-orange-900 dark:text-orange-100 text-sm sm:text-base">
                {t('sessionsPage.offlineMode') || 'Mode hors ligne'}
              </p>
              <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300">
                {t('sessionsPage.offlineSaveMessage') || 'Vos sessions seront synchronisées automatiquement.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('sessionsPage.title')}</h1>
          {!isOnline && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <CloudOff className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mt-1">{t('sessionsPage.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-red-100 dark:bg-red-900/30 rounded-full mb-2 sm:mb-3">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{state.completedPomodoros}</div>
          <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.pomodorosToday')}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-2 sm:mb-3">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
            <span className="hidden sm:inline">{Math.floor(state.totalMinutesToday / 60)}h {state.totalMinutesToday % 60}m</span>
            <span className="sm:hidden">{state.totalMinutesToday}m</span>
          </div>
          <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.studyTime')}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 border border-gray-200 dark:border-gray-700 text-center">
          <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-2 sm:mb-3">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">{state.totalMinutesToday}<span className="text-sm sm:text-base">m</span></div>
          <div className="text-[10px] sm:text-xs lg:text-sm text-gray-600 dark:text-gray-400">{t('sessionsPage.dayRecord')}</div>
        </div>
      </div>

      {/* Main Timer */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-4 sm:p-8 lg:p-12">
        {/* Session Type Selector */}
        <div className="flex justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-8">
          {sessionTypes.map(({ type, icon: Icon, colorClass }) => (
            <button
              key={type}
              onClick={() => setSessionType(type)}
              className={`px-2.5 sm:px-4 lg:px-6 py-2 sm:py-3 rounded-lg font-medium sm:font-semibold transition text-xs sm:text-sm lg:text-base ${
                state.sessionType === type
                  ? `${colorClass} text-white`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              disabled={state.isRunning}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{getSessionLabel(type)}</span>
              <span className="sm:hidden">
                {type === 'work' ? 'Focus' : type === 'short_break' ? 'Pause' : 'Long'}
              </span>
            </button>
          ))}
        </div>

        {/* Subject Input */}
        {state.sessionType === 'work' && !state.isRunning && (
          <div className="mb-4 sm:mb-8 px-2 sm:px-0">
            <input
              type="text"
              value={state.subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('sessionsPage.workingOn')}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-sm sm:text-base"
            />
          </div>
        )}

        {/* Current Subject Display */}
        {state.subject && state.isRunning && (
          <div className="text-center mb-3 sm:mb-4">
            <span className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 text-sm sm:text-base">
              {state.subject}
            </span>
          </div>
        )}

        {/* Timer Display */}
        <div className="relative mb-4 sm:mb-8">
          <svg className="w-full max-w-[200px] sm:max-w-xs lg:max-w-md mx-auto" viewBox="0 0 200 200">
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
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                {formatTime(state.timeLeft)}
              </div>
              <div className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400">
                {state.isPaused ? (
                  <span className="text-orange-500 font-medium">EN PAUSE</span>
                ) : (
                  <span className="hidden sm:inline">{getSessionLabel(state.sessionType)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          {!state.isRunning ? (
            <button
              onClick={() => startSession(undefined, true)}
              className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold text-sm sm:text-base lg:text-lg flex items-center gap-1.5 sm:gap-2 shadow-lg"
            >
              <Play className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>{t('sessionsPage.start')}</span>
            </button>
          ) : state.isPaused ? (
            <button
              onClick={resumeSession}
              className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold text-sm sm:text-base lg:text-lg flex items-center gap-1.5 sm:gap-2 shadow-lg"
            >
              <Play className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">{t('sessionsPage.resume') || 'Reprendre'}</span>
              <span className="sm:hidden">Go</span>
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition font-semibold text-sm sm:text-base lg:text-lg flex items-center gap-1.5 sm:gap-2 shadow-lg"
            >
              <Pause className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>{t('sessionsPage.pause')}</span>
            </button>
          )}

          {state.isRunning && (
            <button
              onClick={stopSession}
              className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition font-semibold text-sm sm:text-base lg:text-lg flex items-center gap-1.5 sm:gap-2"
            >
              <Square className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">{t('sessionsPage.stop') || 'Arrêter'}</span>
              <span className="sm:hidden">Stop</span>
            </button>
          )}

          <button
            onClick={resetSession}
            className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition font-semibold text-sm sm:text-base lg:text-lg flex items-center gap-1.5 sm:gap-2"
          >
            <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden sm:inline">{t('sessionsPage.reset')}</span>
          </button>
        </div>

        {/* Persistence indicator */}
        <div className="mt-4 sm:mt-6 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-2">
            {isOnline
              ? (t('sessionsPage.timerPersistence') || 'Le timer continue même si vous changez de page')
              : (t('sessionsPage.offlineTimerPersistence') || 'Mode offline - sync automatique')
            }
          </p>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">{t('sessionsPage.howItWorks')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm">
              1
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-xs sm:text-sm">{t('sessionsPage.step1Title')}</div>
              <div className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs line-clamp-2 sm:line-clamp-none">{t('sessionsPage.step1Desc')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm">
              2
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-xs sm:text-sm">{t('sessionsPage.step2Title')}</div>
              <div className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs line-clamp-2 sm:line-clamp-none">{t('sessionsPage.step2Desc')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-xs sm:text-sm">
              3
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-xs sm:text-sm">{t('sessionsPage.step3Title')}</div>
              <div className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs line-clamp-2 sm:line-clamp-none">{t('sessionsPage.step3Desc')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-xs sm:text-sm">
              4
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 text-xs sm:text-sm">{t('sessionsPage.step4Title')}</div>
              <div className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs line-clamp-2 sm:line-clamp-none">{t('sessionsPage.step4Desc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pomodoro Counter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">{t('sessionsPage.completedPomodoros')}</h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {[...Array(state.completedPomodoros)].map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold"
            >
              <Target className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          ))}
          {[...Array(Math.max(0, 4 - (state.completedPomodoros % 4)))].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center"
            >
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 dark:text-gray-500" />
            </div>
          ))}
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 sm:mt-3">
          {state.completedPomodoros % 4 === 0 && state.completedPomodoros > 0
            ? t('sessionsPage.cycleComplete')
            : t('sessionsPage.untilLongBreak', { count: 4 - (state.completedPomodoros % 4) })}
        </p>
      </div>
    </div>
  )
}
