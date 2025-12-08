import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/common/Toast'
import { Save, Cloud, CloudOff } from 'lucide-react'

interface AutosaveIndicatorProps {
  formKey: string
  data: any
  onRestore?: (data: any) => void
  debounceMs?: number
}

export function useAutosave<T>(
  key: string,
  data: T,
  debounceMs: number = 3000
): {
  lastSaved: Date | null
  savedData: T | null
  clearSaved: () => void
  status: 'idle' | 'saving' | 'saved' | 'error'
} {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const storageKey = `autosave_${key}`

  // Load saved data on mount
  const [savedData, setSavedData] = useState<T | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.data
      }
    } catch (error) {
      console.error('Failed to load autosaved data:', error)
    }
    return null
  })

  // Autosave with debounce
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setStatus('saving')

    timeoutRef.current = setTimeout(() => {
      try {
        const saveData = {
          data,
          timestamp: new Date().toISOString(),
        }
        localStorage.setItem(storageKey, JSON.stringify(saveData))
        setLastSaved(new Date())
        setStatus('saved')
        
        // Reset status after 2 seconds
        setTimeout(() => setStatus('idle'), 2000)
      } catch (error) {
        console.error('Autosave failed:', error)
        setStatus('error')
      }
    }, debounceMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, debounceMs, storageKey])

  const clearSaved = () => {
    localStorage.removeItem(storageKey)
    setSavedData(null)
  }

  return { lastSaved, savedData, clearSaved, status }
}

export function AutosaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {status === 'saving' && (
        <>
          <Cloud className="h-3 w-3 animate-pulse" />
          <span>Salvando...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Save className="h-3 w-3 text-green-500" />
          <span className="text-green-600">Salvo automaticamente</span>
        </>
      )}
      {status === 'error' && (
        <>
          <CloudOff className="h-3 w-3 text-red-500" />
          <span className="text-red-600">Erro ao salvar</span>
        </>
      )}
    </div>
  )
}

export function AutosaveRestorePrompt<T>({ 
  savedData, 
  onRestore, 
  onDiscard 
}: { 
  savedData: T | null
  onRestore: (data: T) => void
  onDiscard: () => void
}) {
  if (!savedData) return null

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <Save className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
            Rascunho encontrado
          </h4>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Existe um rascunho salvo automaticamente. Deseja restaurá-lo?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onRestore(savedData)}
              className="px-3 py-1.5 text-sm font-medium bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Restaurar rascunho
            </button>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
