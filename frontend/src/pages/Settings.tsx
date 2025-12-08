import { useState } from 'react'
import { User, Palette, Bell, Settings as SettingsIcon, Sun, Moon, Monitor, ChevronRight, Trash2, Info, Save, Sidebar } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useSidebar } from '@/context/SidebarContext'
import { useToast } from '@/components/common/Toast'

// Reusable Section Component
function SettingsSection({ 
  title, 
  icon: Icon, 
  children,
  defaultOpen = true 
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t">
          {children}
        </div>
      )}
    </div>
  )
}

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
          checked ? 'bg-primary' : 'bg-muted'
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

  const handleSave = async () => {
    setIsSaving(true)
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsSaving(false)
    toast.success('Perfil atualizado com sucesso!')
  }

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xl font-bold">
          {initials || 'U'}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Foto do Perfil</p>
          <p className="text-xs text-muted-foreground mt-1">As iniciais são geradas automaticamente</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">O email não pode ser alterado</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Função</label>
          <div className="px-3 py-2 border rounded-lg bg-muted text-muted-foreground">
            {user?.role === 'ADMIN' ? 'Administrador' : 'Usuário'}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
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
    <div className="pt-4 space-y-4">
      <div>
        <p className="font-medium text-foreground mb-3">Tema</p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                theme === value 
                  ? 'border-primary bg-primary/10' 
                  : 'border-transparent bg-muted hover:bg-accent'
              }`}
            >
              <Icon className={`h-5 w-5 ${theme === value ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm ${theme === value ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t pt-4">
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
    <div className="pt-4 divide-y">
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
      <div className="pt-3">
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
    
    // Clear localStorage except essential items
    const token = localStorage.getItem('token')
    const theme = localStorage.getItem('theme')
    const sidebarPref = localStorage.getItem('sidebar-expanded')
    
    localStorage.clear()
    
    // Restore essential items
    if (token) localStorage.setItem('token', token)
    if (theme) localStorage.setItem('theme', theme)
    if (sidebarPref) localStorage.setItem('sidebar-expanded', sidebarPref)
    
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsClearing(false)
    toast.success('Cache limpo com sucesso!')
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-medium text-foreground">Versão do Sistema</p>
          <p className="text-sm text-muted-foreground">Gestão Cases</p>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
          v2.0.0
        </span>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Limpar Cache</p>
            <p className="text-sm text-muted-foreground">Remove dados temporários do navegador</p>
          </div>
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="flex items-center gap-2 px-3 py-2 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isClearing ? 'Limpando...' : 'Limpar'}
          </button>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Info className="h-5 w-5 text-muted-foreground" />
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

// Main Settings Page
export function Settings() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas preferências e configurações do sistema</p>
      </div>

      <div className="space-y-4">
        <SettingsSection title="Perfil do Usuário" icon={User}>
          <ProfileSection />
        </SettingsSection>

        <SettingsSection title="Aparência" icon={Palette}>
          <AppearanceSection />
        </SettingsSection>

        <SettingsSection title="Notificações" icon={Bell} defaultOpen={false}>
          <NotificationsSection />
        </SettingsSection>

        <SettingsSection title="Sistema" icon={SettingsIcon} defaultOpen={false}>
          <SystemSection />
        </SettingsSection>
      </div>
    </div>
  )
}
