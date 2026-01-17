'use client'

import { HelpCircle, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HelpTooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  icon?: 'help' | 'info'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function HelpTooltip({
  content,
  side = 'top',
  icon = 'help',
  size = 'sm',
  className = ''
}: HelpTooltipProps) {
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const Icon = icon === 'help' ? HelpCircle : Info

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-help ${className}`}
          >
            <Icon className={sizeClasses[size]} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-3 py-2 rounded-lg shadow-lg"
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Composant pour wrapper un élément avec un tooltip
interface WithTooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

export function WithTooltip({
  content,
  children,
  side = 'top',
  className = ''
}: WithTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={className}>{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-3 py-2 rounded-lg shadow-lg"
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
