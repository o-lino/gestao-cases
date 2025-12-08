import { createContext, useContext, useState, ReactNode } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (type: ToastType, message: string) => {
    const id = Math.random().toString(36)
    setToasts(prev => [...prev, { id, type, message }])
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const contextValue: ToastContextType = {
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    warning: (message: string) => addToast('warning', message),
    info: (message: string) => addToast('info', message),
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const config = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      className: 'bg-green-50 border-green-200'
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      className: 'bg-red-50 border-red-200'
    },
    warning: {
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      className: 'bg-yellow-50 border-yellow-200'
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-600" />,
      className: 'bg-blue-50 border-blue-200'
    }
  }

  const { icon, className } = config[toast.type]

  return (
    <div 
      className={`${className} border rounded-lg p-4 shadow-lg min-w-[300px] max-w-md flex items-start gap-3 animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      {icon}
      <p className="flex-1 text-sm text-gray-900">{toast.message}</p>
      <button 
        onClick={onClose} 
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
