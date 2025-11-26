import { useState, useCallback } from 'react'

interface Toast {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(({ title, description, variant = 'default' }: Toast) => {
    // Simple console log for now - in production you'd use a toast library
    if (variant === 'destructive') {
      console.error(`[Toast Error] ${title}: ${description}`)
    } else {
      console.log(`[Toast] ${title}: ${description}`)
    }

    // You can integrate with a real toast library like sonner or react-hot-toast
    const newToast = { title, description, variant }
    setToasts(prev => [...prev, newToast])

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t !== newToast))
    }, 3000)
  }, [])

  return { toast, toasts }
}
