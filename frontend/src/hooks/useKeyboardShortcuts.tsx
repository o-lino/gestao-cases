import { useEffect, useState } from 'react'
import { Command } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
  global?: boolean
}

// Hook to register keyboard shortcuts
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is on input/textarea
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        // Allow global shortcuts even in inputs
        const globalShortcut = shortcuts.find(s => 
          s.global &&
          s.key.toLowerCase() === e.key.toLowerCase() &&
          !!s.ctrl === e.ctrlKey &&
          !!s.shift === e.shiftKey &&
          !!s.alt === e.altKey
        )
        if (globalShortcut) {
          e.preventDefault()
          globalShortcut.action()
        }
        return
      }

      const shortcut = shortcuts.find(s =>
        s.key.toLowerCase() === e.key.toLowerCase() &&
        !!s.ctrl === e.ctrlKey &&
        !!s.shift === e.shiftKey &&
        !!s.alt === e.altKey
      )

      if (shortcut) {
        e.preventDefault()
        shortcut.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

// Format shortcut key for display
export function formatShortcutKey(shortcut: Omit<KeyboardShortcut, 'action' | 'description'>): string {
  const parts = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  parts.push(shortcut.key.toUpperCase())
  return parts.join(' + ')
}

// Keyboard Shortcut Badge Component
export function ShortcutBadge({ 
  shortcut, 
  className 
}: { 
  shortcut: Omit<KeyboardShortcut, 'action' | 'description'>
  className?: string 
}) {
  return (
    <kbd className={cn(
      "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-muted rounded border shadow-sm",
      className
    )}>
      {shortcut.ctrl && <span>⌘</span>}
      {shortcut.shift && <span>⇧</span>}
      {shortcut.alt && <span>⌥</span>}
      <span>{shortcut.key.toUpperCase()}</span>
    </kbd>
  )
}

// Keyboard Shortcuts Help Panel
interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[]
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsHelp({ shortcuts, isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  // Group shortcuts by category
  const categories = [
    { name: 'Navegação', shortcuts: shortcuts.filter(s => ['g', 'h', 'c', 's'].includes(s.key.toLowerCase())) },
    { name: 'Ações', shortcuts: shortcuts.filter(s => ['n', 'e', 'd', 'Enter'].includes(s.key)) },
    { name: 'Sistema', shortcuts: shortcuts.filter(s => s.key === '?' || s.key === 'Escape' || s.ctrl) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Command className="h-5 w-5" />
            Atalhos de Teclado
          </h2>
          <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        <div className="space-y-6">
          {categories.map(category => (
            category.shortcuts.length > 0 && (
              <div key={category.name}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{category.name}</h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{shortcut.description}</span>
                      <ShortcutBadge shortcut={shortcut} />
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground text-center">
          Pressione <ShortcutBadge shortcut={{ key: '?' }} className="mx-1" /> a qualquer momento para ver este painel
        </div>
      </div>
    </div>
  )
}

// Default app shortcuts hook
export function useAppShortcuts(options: {
  onNewCase?: () => void
  onSearch?: () => void
  onDashboard?: () => void
  onCases?: () => void
  onSettings?: () => void
}) {
  const [showHelp, setShowHelp] = useState(false)

  const shortcuts: KeyboardShortcut[] = [
    { key: '?', description: 'Mostrar atalhos', action: () => setShowHelp(true) },
    { key: 'Escape', description: 'Fechar modal/painel', action: () => setShowHelp(false), global: true },
    ...(options.onNewCase ? [{ key: 'n', description: 'Novo Case', action: options.onNewCase }] : []),
    ...(options.onSearch ? [{ key: '/', description: 'Buscar', action: options.onSearch }] : []),
    ...(options.onDashboard ? [{ key: 'h', description: 'Ir para Dashboard', action: options.onDashboard }] : []),
    ...(options.onCases ? [{ key: 'c', description: 'Ir para Cases', action: options.onCases }] : []),
    ...(options.onSettings ? [{ key: 's', shift: true, description: 'Configurações', action: options.onSettings }] : []),
    { key: 's', ctrl: true, description: 'Salvar', action: () => {}, global: true },
  ]

  useKeyboardShortcuts(shortcuts)

  return { showHelp, setShowHelp, shortcuts }
}
