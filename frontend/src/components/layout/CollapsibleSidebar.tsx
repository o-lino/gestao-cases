import { LayoutDashboard, FolderOpen, Settings, LogOut, ChevronLeft, ChevronRight, X, Clock, Users, Shield, UserCheck, Database } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth, UserRole } from '@/context/AuthContext'
import { useResponsive } from '@/hooks/useResponsive'
import { useSidebar } from '@/context/SidebarContext'
import { useEffect, useMemo } from 'react'

type NavItem = {
  name: string
  href: string
  icon: any
  roles?: string[] // If undefined, show to all; if defined, show only to these roles
}

// Base navigation items
const baseNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cases', href: '/cases', icon: FolderOpen },
  { name: 'Pendências', href: '/pending-reviews', icon: Clock }, // All users have their own pending items
  { name: 'Curadoria', href: '/curator', icon: Database, roles: [UserRole.CURATOR, UserRole.MODERATOR, UserRole.ADMIN] },
  { name: 'Moderação', href: '/moderation', icon: UserCheck, roles: [UserRole.MODERATOR, UserRole.ADMIN] },
  { name: 'Configurações', href: '/settings', icon: Settings },
]

// Admin-only items
const adminNavigation: NavItem[] = [
  { name: 'Usuários', href: '/admin/users', icon: Users, roles: [UserRole.ADMIN] },
  { name: 'Administração', href: '/admin', icon: Shield, roles: [UserRole.ADMIN] },
]

export function CollapsibleSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const { isMobile, isTablet } = useResponsive()
  const { isOpen, isExpanded, expand, collapse, close } = useSidebar()

  // Filter navigation based on user role
  const navigation = useMemo(() => {
    const allItems = [...baseNavigation, ...adminNavigation]
    return allItems.filter(item => {
      if (!item.roles) return true // Show to all
      return item.roles.includes(user?.role || '')
    })
  }, [user?.role])

  // Auto close on mobile/tablet when navigating
  useEffect(() => {
    if (isMobile || isTablet) {
      close()
    }
  }, [location.pathname, isMobile, isTablet, close])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarWidth = isExpanded ? 'w-64' : 'w-[72px]'
  const showLabels = isExpanded

  // Mobile/Tablet: Overlay drawer
  if (isMobile || isTablet) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden cursor-pointer transition-opacity duration-300"
            onClick={close}
            aria-label="Fechar menu"
          />
        )}
        
        {/* Sidebar Drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r shadow-2xl lg:hidden",
            "transform transition-transform duration-300 ease-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Header with gradient accent */}
            <div className="flex h-16 items-center justify-between px-6 border-b bg-gradient-to-r from-orange-500 to-amber-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FolderOpen className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">Gestão Cases</span>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6">
              <nav className="space-y-2 px-3">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "mr-3 h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110",
                          isActive ? "text-white" : "text-gray-400 group-hover:text-orange-500"
                        )}
                      />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Logout */}
            <div className="border-t p-4">
              <button 
                onClick={handleLogout}
                className="group flex w-full items-center px-4 py-3 text-sm font-medium text-gray-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all duration-200"
              >
                <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-red-500 transition-transform group-hover:scale-110" />
                Sair
              </button>
            </div>
          </div>
        </aside>
      </>
    )
  }

  // Desktop: Collapsible sidebar
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col bg-white border-r shadow-sm transition-all duration-300 ease-out",
        sidebarWidth
      )}
    >
      {/* Header with gradient accent */}
      <div className={cn(
        "flex h-16 items-center border-b",
        showLabels ? "justify-between px-4 bg-gradient-to-r from-orange-500 to-amber-500" : "justify-center bg-gradient-to-b from-orange-500 to-amber-500"
      )}>
        {showLabels && (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white">Gestão Cases</span>
          </div>
        )}
        <button
          onClick={() => isExpanded ? collapse() : expand()}
          className={cn(
            "p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors",
            !showLabels && "mx-auto"
          )}
          aria-label={isExpanded ? "Recolher menu" : "Expandir menu"}
        >
          {isExpanded ? <ChevronLeft size={20} className="text-white" /> : <ChevronRight size={20} className="text-white" />}
        </button>
      </div>
      
      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-2 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 relative",
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                    : "text-gray-600 hover:bg-gray-100",
                  !showLabels && "justify-center px-2"
                )}
                title={!showLabels ? item.name : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110",
                    showLabels && "mr-3",
                    isActive ? "text-white" : "text-gray-400 group-hover:text-orange-500"
                  )}
                />
                {showLabels && item.name}
                
                {/* Tooltip for collapsed state */}
                {!showLabels && (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="border-t p-4">
        <button 
          onClick={handleLogout}
          className={cn(
            "group flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all duration-200 relative",
            !showLabels && "justify-center px-2"
          )}
          title={!showLabels ? "Sair" : undefined}
        >
          <LogOut className={cn(
            "h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-red-500 transition-transform group-hover:scale-110",
            showLabels && "mr-3"
          )} />
          {showLabels && "Sair"}
          
          {/* Tooltip for collapsed state */}
          {!showLabels && (
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Sair
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
