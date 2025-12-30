import { useState, useEffect } from 'react'
import { User, Palette, Bell, Settings as SettingsIcon, Sun, Moon, Monitor, Trash2, Info, Save } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useSidebar } from '@/context/SidebarContext'
import { useToast } from '@/components/common/Toast'
import { PageLayout, PageTab } from '@/components/common/PageLayout'

type TabType = 'profile' | 'appearance' | 'notifications' | 'system'

// Toggle Switch Component
function Toggle({ 
  checked, 
  onChange, 
  label,
  description
}: { 
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-foreground">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-orange-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

// Profile Section
function ProfileSection() {
  const { user } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user?.name || '')
  const [isSaving, setIsSaving] = useState(false)

  // Sync name with user when user data loads/changes
  useEffect(() => {
    if (user?.name) {
      setName(user.name)
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsSaving(false)
    toast.success('Perfil atualizado com sucesso!')
  }

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xl font-bold border-4 border-orange-50">
          {initials || 'U'}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Foto do Perfil</p>
          <p className="text-xs text-muted-foreground mt-1">As iniciais são geradas automaticamente</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-foreground focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Função</label>
          <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500">
            {user?.role === 'ADMIN' ? 'Administrador' : 'Usuário'}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-sm"
      >
        <Save className="h-4 w-4" />
        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  )
}

// Appearance Section
function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { isExpanded, expand, collapse } = useSidebar()
  const toast = useToast()

  const themes = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ] as const

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    toast.success(`Tema alterado para ${themes.find(t => t.value === newTheme)?.label}`)
  }

  const handleSidebarToggle = (expanded: boolean) => {
    if (expanded) {
      expand()
    } else {
      collapse()
    }
    toast.success(`Sidebar ${expanded ? 'expandida' : 'contraída'} por padrão`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-medium text-foreground mb-3">Tema</p>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === value 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-transparent bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <Icon className={`h-6 w-6 ${theme === value ? 'text-orange-600' : 'text-gray-500'}`} />
              <span className={`text-sm ${theme === value ? 'text-orange-700 font-medium' : 'text-gray-500'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <Toggle
          checked={isExpanded}
          onChange={handleSidebarToggle}
          label="Sidebar Expandida"
          description="Manter a sidebar aberta por padrão no desktop"
        />
      </div>
    </div>
  )
}

// Notifications Section
function NotificationsSection() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [caseAlerts, setCaseAlerts] = useState(true)
  const toast = useToast()

  const handleChange = (setter: (v: boolean) => void, value: boolean, label: string) => {
    setter(value)
    toast.success(`${label} ${value ? 'ativado' : 'desativado'}`)
  }

  return (
    <div className="divide-y divide-gray-100">
      <Toggle
        checked={emailNotifications}
        onChange={(v) => handleChange(setEmailNotifications, v, 'Notificações por email')}
        label="Notificações por Email"
        description="Receber atualizações importantes por email"
      />
      <Toggle
        checked={pushNotifications}
        onChange={(v) => handleChange(setPushNotifications, v, 'Notificações push')}
        label="Notificações Push"
        description="Receber alertas no navegador"
      />
      <Toggle
        checked={caseAlerts}
        onChange={(v) => handleChange(setCaseAlerts, v, 'Alertas de cases')}
        label="Alertas de Cases"
        description="Ser notificado quando um case mudar de status"
      />
      <div className="pt-4">
        <p className="text-sm text-muted-foreground italic">
          * As notificações serão implementadas em breve
        </p>
      </div>
    </div>
  )
}

// System Section
function SystemSection() {
  const toast = useToast()
  const [isClearing, setIsClearing] = useState(false)

  const handleClearCache = async () => {
    setIsClearing(true)
    
    const token = localStorage.getItem('token')
    const theme = localStorage.getItem('theme')
    const sidebarPref = localStorage.getItem('sidebar-expanded')
    
    localStorage.clear()
    
    if (token) localStorage.setItem('token', token)
    if (theme) localStorage.setItem('theme', theme)
    if (sidebarPref) localStorage.setItem('sidebar-expanded', sidebarPref)
    
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsClearing(false)
    toast.success('Cache limpo com sucesso!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-medium text-foreground">Versão do Sistema</p>
          <p className="text-sm text-muted-foreground">Gestão Cases</p>
        </div>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
          v2.0.0
        </span>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Limpar Cache</p>
            <p className="text-sm text-muted-foreground">Remove dados temporários do navegador</p>
          </div>
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isClearing ? 'Limpando...' : 'Limpar'}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <Info className="h-5 w-5 text-gray-400" />
          <div className="text-sm text-muted-foreground">
            <p>Ambiente: <span className="font-medium text-foreground">Desenvolvimento</span></p>
            <p>Backend: <span className="font-medium text-foreground">FastAPI</span></p>
            <p>Frontend: <span className="font-medium text-foreground">React + Vite</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tab Configuration
const TABS: PageTab[] = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'system', label: 'Sistema', icon: SettingsIcon },
]

// Main Settings Page
export function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')

  return (
    <PageLayout
      title="Configurações"
      subtitle="Gerencie suas preferências e configurações do sistema"
      icon={SettingsIcon}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabType)}
    >
      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'profile' && <ProfileSection />}
        {activeTab === 'appearance' && <AppearanceSection />}
        {activeTab === 'notifications' && <NotificationsSection />}
        {activeTab === 'system' && <SystemSection />}
      </div>
    </PageLayout>
  )
}
