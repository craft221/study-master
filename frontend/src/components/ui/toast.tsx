import * as React from "react"

export interface ToastProps {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  onClose?: () => void
}

export const Toast: React.FC<ToastProps> = ({ title, description, variant = 'default', onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed top-4 right-4 z-50 w-96 rounded-lg border p-4 shadow-lg ${
        variant === 'destructive'
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export const Toaster: React.FC<{ toasts: ToastProps[] }> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast, index) => (
        <Toast key={index} {...toast} />
      ))}
    </div>
  )
}
