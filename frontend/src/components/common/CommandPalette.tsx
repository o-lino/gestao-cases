import { useState, useMemo } from 'react'
import { 
  Search, Plus, FileText, Settings, Users, LayoutDashboard, 
  FolderKanban, Clock, Star, Filter, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<any>
  action: () => void
  shortcut?: string
  category: 'navigation' | 'action' | 'recent'
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  recentCases?: Array<{ id: number; title: string }>
}

export function CommandPalette({ isOpen, onClose, recentCases = [] }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const actions = useMemo<QuickAction[]>(() => {
    const baseActions: QuickAction[] = [
      // Navigation
      { id: 'nav-dashboard', label: 'Ir para Dashboard', icon: LayoutDashboard, action: () => { navigate('/'); onClose(); }, shortcut: 'H', category: 'navigation' },
      { id: 'nav-cases', label: 'Ir para Cases', icon: FolderKanban, action: () => { navigate('/cases'); onClose(); }, shortcut: 'C', category: 'navigation' },
      { id: 'nav-kanban', label: 'Ver Kanban', icon: FolderKanban, action: () => { navigate('/cases?view=kanban'); onClose(); }, category: 'navigation' },
      { id: 'nav-settings', label: 'Configurações', icon: Settings, action: () => { navigate('/settings'); onClose(); }, shortcut: 'S', category: 'navigation' },
      { id: 'nav-admin', label: 'Administração', icon: Users, action: () => { navigate('/admin'); onClose(); }, category: 'navigation' },
      
      // Actions
      { id: 'action-new', label: 'Novo Case', icon: Plus, action: () => { navigate('/cases/new'); onClose(); }, shortcut: 'N', category: 'action' },
      { id: 'action-favorites', label: 'Ver Favoritos', icon: Star, action: () => { navigate('/cases?favorites=true'); onClose(); }, category: 'action' },
      { id: 'action-recent', label: 'Cases Recentes', icon: Clock, action: () => { navigate('/cases?sort=updated_at'); onClose(); }, category: 'action' },
      
      // Recent cases
      ...recentCases.slice(0, 5).map(c => ({
        id: `recent-${c.id}`,
        label: `#${c.id} - ${c.title}`,
        icon: FileText,
        action: () => { navigate(`/cases/${c.id}`); onClose(); },
        category: 'recent' as const,
      })),
    ]

    if (!query) return baseActions

    return baseActions.filter(a => 
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.id.includes(query.toLowerCase())
    )
  }, [query, navigate, onClose, recentCases])

  const groupedActions = useMemo(() => ({
    navigation: actions.filter(a => a.category === 'navigation'),
    action: actions.filter(a => a.category === 'action'),
    recent: actions.filter(a => a.category === 'recent'),
  }), [actions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % actions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + actions.length) % actions.length)
        break
      case 'Enter':
        e.preventDefault()
        if (actions[selectedIndex]) {
          actions[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando ou busque..."
            className="flex-1 bg-transparent outline-none text-lg"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-muted rounded">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {actions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            <>
              {/* Navigation */}
              {groupedActions.navigation.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Navegação</div>
                  {groupedActions.navigation.map((action, i) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      isSelected={actions.indexOf(action) === selectedIndex}
                      onClick={() => action.action()}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              {groupedActions.action.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Ações</div>
                  {groupedActions.action.map((action, i) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      isSelected={actions.indexOf(action) === selectedIndex}
                      onClick={() => action.action()}
                    />
                  ))}
                </div>
              )}

              {/* Recent */}
              {groupedActions.recent.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Recentes</div>
                  {groupedActions.recent.map((action, i) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      isSelected={actions.indexOf(action) === selectedIndex}
                      onClick={() => action.action()}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>↑↓ Navegar</span>
            <span>↵ Selecionar</span>
            <span>Esc Fechar</span>
          </div>
          <span>Ctrl+K para abrir</span>
        </div>
      </div>
    </div>
  )
}

function ActionItem({ 
  action, 
  isSelected, 
  onClick 
}: { 
  action: QuickAction
  isSelected: boolean
  onClick: () => void 
}) {
  const Icon = action.icon
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left",
        isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      )}
    >
      <Icon className={cn("h-4 w-4", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{action.label}</span>
      {action.shortcut && (
        <kbd className={cn(
          "px-1.5 py-0.5 text-xs font-mono rounded",
          isSelected ? "bg-primary-foreground/20" : "bg-muted"
        )}>
          {action.shortcut}
        </kbd>
      )}
    </button>
  )
}

// Hook to manage command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  // Listen for Ctrl+K
  useState(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }
}
