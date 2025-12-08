import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'

interface SidebarContextType {
  isOpen: boolean
  isExpanded: boolean
  toggle: () => void
  expand: () => void
  collapse: () => void
  close: () => void
  open: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false) // For mobile overlay
  const [isExpanded, setIsExpanded] = useState(() => {
    // Try to get saved preference from localStorage
    const saved = localStorage.getItem('sidebar-expanded')
    return saved !== null ? saved === 'true' : true
  })

  // Save preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', String(isExpanded))
  }, [isExpanded])

  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  const expand = useCallback(() => setIsExpanded(true), [])
  const collapse = useCallback(() => setIsExpanded(false), [])
  const close = useCallback(() => setIsOpen(false), [])
  const open = useCallback(() => setIsOpen(true), [])

  const value = useMemo(() => ({
    isOpen,
    isExpanded,
    toggle,
    expand,
    collapse,
    close,
    open
  }), [isOpen, isExpanded, toggle, expand, collapse, close, open])

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return context
}
