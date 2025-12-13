'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw, Cloud, CloudOff } from 'lucide-react'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface OfflineIndicatorProps {
  className?: string
  showPendingCount?: boolean
  showSyncButton?: boolean
  compact?: boolean
}

export function OfflineIndicator({
  className,
  showPendingCount = true,
  showSyncButton = true,
  compact = false,
}: OfflineIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, sync } = useOfflineContext()
  const [showOfflineMessage, setShowOfflineMessage] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineMessage(true)
      const timer = setTimeout(() => setShowOfflineMessage(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  const handleSync = async () => {
    await sync()
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-1 p-1.5 rounded-full',
                isOnline ? 'bg-green-100' : 'bg-orange-100',
                className
              )}
            >
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-orange-600" />
              )}
              {pendingCount > 0 && (
                <span className="text-xs font-medium text-orange-600">
                  {pendingCount}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOnline ? 'En ligne' : 'Hors ligne'}
              {pendingCount > 0 && ` - ${pendingCount} action(s) en attente`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
        isOnline ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700',
        className
      )}
    >
      {/* Icône de statut */}
      <div className="flex items-center gap-2">
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : isOnline ? (
          <Cloud className="w-4 h-4" />
        ) : (
          <CloudOff className="w-4 h-4" />
        )}

        <span className="text-sm font-medium">
          {isSyncing
            ? 'Synchronisation...'
            : isOnline
            ? 'En ligne'
            : 'Hors ligne'}
        </span>
      </div>

      {/* Compteur d'actions en attente */}
      {showPendingCount && pendingCount > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium bg-orange-200 text-orange-800 rounded-full">
          {pendingCount} en attente
        </span>
      )}

      {/* Bouton de synchronisation */}
      {showSyncButton && isOnline && pendingCount > 0 && !isSyncing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          className="h-6 px-2"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Sync
        </Button>
      )}
    </div>
  )
}

/**
 * Bannière de notification hors ligne
 */
export function OfflineBanner() {
  const { isOnline, pendingCount } = useOfflineContext()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setIsVisible(true)
    } else {
      // Masquer après un délai quand on revient en ligne
      const timer = setTimeout(() => setIsVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all',
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-orange-500 text-white'
      )}
    >
      {isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" />
          Connexion rétablie
          {pendingCount > 0 && ` - Synchronisation de ${pendingCount} action(s)...`}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Mode hors ligne - Vos modifications seront synchronisées automatiquement
        </span>
      )}
    </div>
  )
}

export default OfflineIndicator
