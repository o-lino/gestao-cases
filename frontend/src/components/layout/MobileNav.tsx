import { Menu } from 'lucide-react'
import { useSidebar } from '@/context/SidebarContext'
import { useResponsive } from '@/hooks/useResponsive'

export function MobileNav() {
  const { toggle, isOpen } = useSidebar()
  const { isMobile, isTablet } = useResponsive()

  // Only show on mobile and tablet
  if (!isMobile && !isTablet) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('[MobileNav] Hamburger clicked, current isOpen:', isOpen)
    toggle()
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-lg hover:bg-accent transition-colors lg:hidden relative z-50"
      aria-label="Abrir menu"
    >
      <Menu size={24} />
    </button>
  )
}
