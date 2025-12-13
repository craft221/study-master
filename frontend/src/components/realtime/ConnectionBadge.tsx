'use client'

import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useWebSocketContext } from '@/components/providers/WebSocketProvider'
import { cn } from '@/lib/utils'

interface ConnectionBadgeProps {
  className?: string
  showLabel?: boolean
}

export function ConnectionBadge({ className, showLabel = true }: ConnectionBadgeProps) {
  const { isConnected, isConnecting, connect } = useWebSocketContext()

  if (isConnecting) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        {showLabel && <span className="text-xs text-blue-600">Connexion...</span>}
      </div>
    )
  }

  if (isConnected) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <div className="relative">
          <Wifi className="h-3.5 w-3.5 text-green-500" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
        {showLabel && <span className="text-xs text-green-600">En direct</span>}
      </div>
    )
  }

  return (
    <button
      onClick={() => connect()}
      className={cn('flex items-center gap-1.5 hover:opacity-80 transition-opacity', className)}
    >
      <WifiOff className="h-3.5 w-3.5 text-gray-400" />
      {showLabel && <span className="text-xs text-gray-500">Hors ligne</span>}
    </button>
  )
}

export default ConnectionBadge
