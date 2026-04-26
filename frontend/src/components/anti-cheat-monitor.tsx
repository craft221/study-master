'use client'

/**
 * Composant de surveillance Anti-Triche
 * Affiche les avertissements et le statut de surveillance
 */

import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, ShieldCheck, Eye, AlertTriangle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ViolationResponse } from '@/services/anti-cheat'
import { useTranslation } from '@/contexts/LanguageContext'

interface AntiCheatMonitorProps {
  isActive: boolean
  violations: ViolationResponse[]
  tabSwitchCount: number
  focusLossCount: number
  showDetails?: boolean
}

export function AntiCheatMonitor({
  isActive,
  violations,
  tabSwitchCount,
  focusLossCount,
  showDetails = false
}: AntiCheatMonitorProps) {
  const { t } = useTranslation()
  const [showWarning, setShowWarning] = useState(false)
  const [lastViolation, setLastViolation] = useState<ViolationResponse | null>(null)

  // Afficher un avertissement temporaire lors d'une nouvelle violation
  useEffect(() => {
    if (violations.length > 0) {
      const latest = violations[violations.length - 1]
      setLastViolation(latest)
      setShowWarning(true)

      const timer = setTimeout(() => {
        setShowWarning(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [violations])

  // Déterminer le statut global
  const getStatus = () => {
    if (!isActive) return { color: 'gray', icon: Shield, text: t('antiCheat.statusInactive') }

    const highSeverity = violations.filter(v => v.severity === 'high' || v.severity === 'critical').length

    if (highSeverity > 0) {
      return { color: 'red', icon: ShieldAlert, text: t('antiCheat.statusAlert') }
    }
    if (violations.length > 0 || tabSwitchCount > 3 || focusLossCount > 5) {
      return { color: 'yellow', icon: AlertTriangle, text: t('antiCheat.statusAttention') }
    }
    return { color: 'green', icon: ShieldCheck, text: t('antiCheat.statusOk') }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  return (
    <div className="space-y-2">
      {/* Badge de statut */}
      <Badge
        variant={status.color === 'red' ? 'destructive' : status.color === 'yellow' ? 'secondary' : 'default'}
        className={`gap-1 ${
          status.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
          status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
          status.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
          ''
        }`}
        title={t('antiCheat.monitoringTooltip')}
      >
        <StatusIcon className="h-3 w-3" />
        <Eye className="h-3 w-3" />
        {t('antiCheat.monitoring')}
      </Badge>

      {/* Avertissement temporaire */}
      {showWarning && lastViolation && (
        <div
          className={`flex items-start gap-2 p-3 rounded-lg border animate-in fade-in slide-in-from-top-2 ${
            lastViolation.severity === 'high' || lastViolation.severity === 'critical'
              ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
          }`}
        >
          <AlertTriangle className={`h-4 w-4 mt-0.5 ${
            lastViolation.severity === 'high' || lastViolation.severity === 'critical'
              ? 'text-red-600' : 'text-yellow-600'
          }`} />
          <div>
            <p className="font-medium text-sm">{t('antiCheat.behaviorDetected')}</p>
            <p className="text-xs text-muted-foreground">{lastViolation.message}</p>
          </div>
        </div>
      )}

      {/* Détails (optionnel) */}
      {showDetails && isActive && (
        <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted rounded-lg">
          <div className="flex justify-between">
            <span>{t('antiCheat.tabSwitches')}</span>
            <span className={tabSwitchCount > 3 ? 'text-yellow-500' : ''}>{tabSwitchCount}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('antiCheat.focusLosses')}</span>
            <span className={focusLossCount > 5 ? 'text-yellow-500' : ''}>{focusLossCount}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('antiCheat.warnings')}</span>
            <span className={violations.length > 0 ? 'text-red-500' : ''}>{violations.length}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Composant de résultat anti-triche (affiché après le quiz)
interface AntiCheatResultProps {
  isValid: boolean
  violationsCount: number
  penaltyXp: number
  isDisqualified: boolean
  warningMessage: string | null
  adjustedScore: number | null
  originalScore: number
}

export function AntiCheatResult({
  isValid,
  violationsCount,
  penaltyXp,
  isDisqualified,
  warningMessage,
  adjustedScore,
  originalScore
}: AntiCheatResultProps) {
  const { t } = useTranslation()

  if (isValid && violationsCount === 0) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-green-800 dark:text-green-300">{t('antiCheat.quizValidated')}</h4>
          <p className="text-sm text-green-700 dark:text-green-400">
            {t('antiCheat.noSuspicious')}
          </p>
        </div>
      </div>
    )
  }

  if (isDisqualified) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-red-800 dark:text-red-300">{t('antiCheat.resultInvalidated')}</h4>
          <p className="text-sm text-red-700 dark:text-red-400">
            {t('antiCheat.disqualifiedDescription')}
          </p>
          {warningMessage && <p className="text-sm text-red-600 mt-1">{warningMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
      <div className="space-y-1">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
          {t('antiCheat.warningsDetected')}
        </h4>
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          {warningMessage || t('antiCheat.violationsRecorded', { count: violationsCount })}
        </p>
        {penaltyXp > 0 && (
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
            {t('antiCheat.penaltyXp', { xp: penaltyXp })}
          </p>
        )}
        {adjustedScore !== null && adjustedScore !== originalScore && (
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            {t('antiCheat.scoreAdjusted', { original: originalScore, adjusted: Math.round(adjustedScore) })}
          </p>
        )}
      </div>
    </div>
  )
}

export default AntiCheatMonitor
