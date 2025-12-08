
import { User } from 'lucide-react'
import { MobileNav } from './MobileNav'
import { useResponsive } from '@/hooks/useResponsive'
import { useAuth } from '@/context/AuthContext'
import { NotificationBell } from '@/components/common/NotificationBell'

export function Header() {
  const { isMobile } = useResponsive()
  const { user } = useAuth()

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <MobileNav />
        {!isMobile && (
          <div className="flex items-center">
            {/* Breadcrumbs or search could go here */}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <NotificationBell />
        
        {!isMobile && (
          <div className="flex items-center gap-3 border-l pl-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{user?.name || 'Usuário'}</span>
              <span className="text-xs text-gray-500">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
        
        {isMobile && (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/30">
            <User className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    </header>
  )
}
