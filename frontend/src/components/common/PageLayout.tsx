import { ReactNode } from 'react'
import { LucideIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PageTab {
  id: string
  label: string
  icon: LucideIcon
  highlight?: boolean
  badge?: number
  show?: boolean
}

interface PageLayoutProps {
  title: string
  subtitle?: string
  icon: LucideIcon
  iconColor?: string // className for background/text color of the icon container
  tabs?: PageTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  actions?: ReactNode
  children: ReactNode
  className?: string
  activeTabClassName?: string
}

export function PageLayout({
  title,
  subtitle,
  icon: Icon,
  iconColor = "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30",
  tabs = [],
  activeTab,
  onTabChange,
  actions,
  children,
  className,
  activeTabClassName = "border-orange-500 text-orange-600"
}: PageLayoutProps) {
  // Filter visible tabs
  const visibleTabs = tabs.filter(tab => tab.show !== false)

  return (
    <div className={cn("space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-xl", iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs */}
      {/* Tabs */}
      {visibleTabs.length > 0 && (
        <div className="border-b border-gray-200">
          {/* Mobile: Dropdown */}
          <div className="md:hidden pb-4">
            <label htmlFor="tabs-mobile" className="sr-only">Selecionar aba</label>
            <div className="relative">
              <select
                id="tabs-mobile"
                value={activeTab}
                onChange={(e) => onTabChange?.(e.target.value)}
                className="block w-full appearance-none rounded-lg border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-gray-900 shadow-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                {visibleTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                    {tab.badge ? ` (${tab.badge})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Desktop: Standard Tabs */}
          <nav className="hidden md:flex -mb-px gap-1 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? activeTabClassName
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                  {tab.highlight && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-orange-100 text-orange-600 rounded-sm">
                      Novo
                    </span>
                  )}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        // If we have tabs, usually the content is inside a card. 
        // But let's leave it flexible or default to a wrapper.
        // The existing pages wrap content in a card or use direct children.
        // We'll provide a default container but allow override.
        "min-h-[400px]" 
      )}>
        {children}
      </div>
    </div>
  )
}
