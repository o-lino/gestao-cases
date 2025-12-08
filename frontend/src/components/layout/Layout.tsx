import { ReactNode } from 'react'
import { CollapsibleSidebar } from './CollapsibleSidebar'
import { Header } from './Header'
import { SidebarProvider } from '@/context/SidebarContext'

interface LayoutProps {
  children?: ReactNode
}

function LayoutContent({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CollapsibleSidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto">
          <div className="container-responsive py-4 md:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function Layout(props: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent {...props} />
    </SidebarProvider>
  )
}
