import { useState, useEffect } from 'react'
import { 
  Mail, 
  MessageSquare, 
  Bell, 
  Save, 
  RefreshCw,
  Send,
  Loader2,
  FileText,
  Link2,
  Variable,
  Users,
  Bot,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import adminConfigService, { SystemConfig } from '@/services/adminConfigService'
import { useToast } from '@/components/common/Toast'
import api from '@/services/api'

interface ChannelsStatus {
  email: boolean
  teams: boolean
  system: boolean
}

// Per-event channel settings
interface EventChannelSettings {
  email: boolean
  teams: boolean
  system: boolean
}

// Event categories with their events
const EVENT_CATEGORIES = [
  {
    id: 'cases',
    label: 'Cases',
    icon: FileText,
    color: 'blue',
    events: [
      { key: 'notification_on_case_created', label: 'Case criado' },
      { key: 'notification_on_case_approved', label: 'Case aprovado' },
      { key: 'notification_on_case_rejected', label: 'Case rejeitado' }
    ]
  },
  {
    id: 'matching',
    label: 'Matching',
    icon: Link2,
    color: 'green',
    events: [
      { key: 'notification_on_match_suggested', label: 'Sugestão de match encontrada' },
      { key: 'notification_on_owner_review_request', label: 'Solicitação de revisão ao owner' },
      { key: 'notification_on_owner_approved', label: 'Owner aprovou match' },
      { key: 'notification_on_owner_rejected', label: 'Owner rejeitou match' },
      { key: 'notification_on_requester_review_request', label: 'Solicitação de confirmação ao solicitante' },
      { key: 'notification_on_match_confirmed', label: 'Match confirmado' },
      { key: 'notification_on_match_discarded', label: 'Match descartado' },
      { key: 'notification_on_owner_validation_request', label: 'Validação de owner necessária' }
    ]
  },
  {
    id: 'variables',
    label: 'Variáveis',
    icon: Variable,
    color: 'purple',
    events: [
      { key: 'notification_on_variable_added', label: 'Variável adicionada ao case' },
      { key: 'notification_on_variable_approved', label: 'Variável aprovada' },
      { key: 'notification_on_variable_cancelled', label: 'Variável cancelada' }
    ]
  },
  {
    id: 'moderation',
    label: 'Moderação',
    icon: Users,
    color: 'orange',
    events: [
      { key: 'notification_on_moderation_request', label: 'Solicitação de moderação' },
      { key: 'notification_on_moderation_approved', label: 'Moderação aprovada' },
      { key: 'notification_on_moderation_rejected', label: 'Moderação rejeitada' },
      { key: 'notification_on_moderation_cancelled', label: 'Moderação cancelada' },
      { key: 'notification_on_moderation_started', label: 'Moderação iniciada' },
      { key: 'notification_on_moderation_expiring', label: 'Moderação próxima de expirar' },
      { key: 'notification_on_moderation_expired', label: 'Moderação expirada' },
      { key: 'notification_on_moderation_revoked', label: 'Moderação revogada' }
    ]
  },
  {
    id: 'agent',
    label: 'Agente IA',
    icon: Bot,
    color: 'cyan',
    events: [
      { key: 'notification_on_agent_decision_consensus', label: 'Decisão de agente requer consenso' },
      { key: 'notification_on_agent_decision_approved', label: 'Decisão de agente aprovada' },
      { key: 'notification_on_agent_decision_rejected', label: 'Decisão de agente rejeitada' },
      { key: 'notification_on_match_request', label: 'Solicitação de match por agente' }
    ]
  },
  {
    id: 'involvement',
    label: 'Envolvimentos',
    icon: Clock,
    color: 'amber',
    events: [
      { key: 'notification_on_involvement_created', label: 'Envolvimento criado' },
      { key: 'notification_on_involvement_date_set', label: 'Data de entrega definida' },
      { key: 'notification_on_involvement_due_reminder', label: 'Lembrete de prazo' },
      { key: 'notification_on_involvement_overdue', label: 'Prazo vencido' },
      { key: 'notification_on_involvement_completed', label: 'Envolvimento concluído' }
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: AlertCircle,
    color: 'gray',
    events: [
      { key: 'notification_on_sync_completed', label: 'Sincronização de catálogo concluída' },
      { key: 'notification_on_system_alert', label: 'Alertas gerais do sistema' }
    ]
  }
]

// Minimalist visual styles
const SECTION_STYLES = {
  active: 'bg-white border-gray-200 shadow-sm',
  inactive: 'bg-white border-gray-100 opacity-75'
}

// Color mappings for categories - Simplified for minimalism
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  blue: { bg: 'hover:bg-blue-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-blue-500' },
  green: { bg: 'hover:bg-green-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-green-500' },
  purple: { bg: 'hover:bg-purple-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-purple-500' },
  orange: { bg: 'hover:bg-orange-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-orange-500' },
  cyan: { bg: 'hover:bg-cyan-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-cyan-500' },
  amber: { bg: 'hover:bg-amber-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-amber-500' },
  gray: { bg: 'hover:bg-gray-50/50', border: 'border-gray-100', text: 'text-gray-700', icon: 'text-gray-500' }
}

// Default channel settings
const DEFAULT_CHANNELS: EventChannelSettings = { email: true, teams: true, system: true }

// Helper functions
const getConfigValue = (configs: SystemConfig[], key: string, defaultValue: string = ''): string => {
  const config = configs.find(c => c.configKey === key)
  return config?.configValue ?? defaultValue
}

const getBooleanConfig = (configs: SystemConfig[], key: string, defaultValue: boolean = false): boolean => {
  const value = getConfigValue(configs, key, defaultValue ? 'true' : 'false')
  return value.toLowerCase() === 'true'
}

const parseEventChannels = (configs: SystemConfig[], key: string): EventChannelSettings => {
  const value = getConfigValue(configs, key, '')
  if (!value) return { ...DEFAULT_CHANNELS }
  
  try {
    // Try parsing as JSON
    const parsed = JSON.parse(value)
    return {
      email: parsed.email ?? true,
      teams: parsed.teams ?? true,
      system: parsed.system ?? true
    }
  } catch {
    // Backward compatibility: treat "true"/"false" as all channels
    const enabled = value.toLowerCase() === 'true'
    return { email: enabled, teams: enabled, system: enabled }
  }
}

export function NotificationSettings() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [channelsStatus, setChannelsStatus] = useState<ChannelsStatus | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]))

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }
  
  // Channel configs
  const [emailConfig, setEmailConfig] = useState({
    enabled: false,
    smtpHost: '',
    smtpPort: '587',
    from: '',
    useTls: true
  })
  
  const [teamsConfig, setTeamsConfig] = useState({
    enabled: false,
    webhookUrl: ''
  })
  
  const [systemConfig, setSystemConfig] = useState({
    enabled: true
  })
  
  // Per-event channel settings
  const [eventChannels, setEventChannels] = useState<Record<string, EventChannelSettings>>({})

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const [notificationConfigs, eventConfigs, statusResponse] = await Promise.all([
        adminConfigService.listConfigs('notification'),
        adminConfigService.listConfigs('notification_events').catch(() => []),
        api.get('/admin/notifications/status').catch(() => ({ data: null }))
      ])
      
      const allConfigs = [...notificationConfigs, ...eventConfigs]
      setConfigs(allConfigs)
      
      if (statusResponse.data) {
        setChannelsStatus(statusResponse.data.channels)
      }
      
      // Parse channel configs
      setEmailConfig({
        enabled: getBooleanConfig(allConfigs, 'notification_email_enabled', false),
        smtpHost: getConfigValue(allConfigs, 'notification_email_smtp_host', ''),
        smtpPort: getConfigValue(allConfigs, 'notification_email_smtp_port', '587'),
        from: getConfigValue(allConfigs, 'notification_email_from', ''),
        useTls: getBooleanConfig(allConfigs, 'notification_email_use_tls', true)
      })
      
      setTeamsConfig({
        enabled: getBooleanConfig(allConfigs, 'notification_teams_enabled', false),
        webhookUrl: getConfigValue(allConfigs, 'notification_teams_webhook_url', '')
      })
      
      setSystemConfig({
        enabled: getBooleanConfig(allConfigs, 'notification_system_enabled', true)
      })
      
      // Parse per-event channel settings
      const newEventChannels: Record<string, EventChannelSettings> = {}
      EVENT_CATEGORIES.forEach(category => {
        category.events.forEach(event => {
          newEventChannels[event.key] = parseEventChannels(allConfigs, event.key)
        })
      })
      setEventChannels(newEventChannels)
      
    } catch (error) {
      toast.error('Erro ao carregar configurações de notificação')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (key: string, value: string) => {
    await adminConfigService.setConfig(key, value)
  }

  const handleSaveEmail = async () => {
    try {
      setSaving('email')
      await Promise.all([
        saveConfig('notification_email_enabled', emailConfig.enabled ? 'true' : 'false'),
        saveConfig('notification_email_smtp_host', emailConfig.smtpHost),
        saveConfig('notification_email_smtp_port', emailConfig.smtpPort),
        saveConfig('notification_email_from', emailConfig.from),
        saveConfig('notification_email_use_tls', emailConfig.useTls ? 'true' : 'false'),
      ])
      toast.success('Configurações de email salvas!')
      loadConfigs()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveTeams = async () => {
    try {
      setSaving('teams')
      await Promise.all([
        saveConfig('notification_teams_enabled', teamsConfig.enabled ? 'true' : 'false'),
        saveConfig('notification_teams_webhook_url', teamsConfig.webhookUrl),
      ])
      toast.success('Configurações do Teams salvas!')
      loadConfigs()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveSystem = async () => {
    try {
      setSaving('system')
      await saveConfig('notification_system_enabled', systemConfig.enabled ? 'true' : 'false')
      toast.success('Configurações do sistema salvas!')
      loadConfigs()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveEventChannels = async (eventKey: string) => {
    try {
      setSaving(eventKey)
      const channels = eventChannels[eventKey] || DEFAULT_CHANNELS
      await saveConfig(eventKey, JSON.stringify(channels))
      toast.success('Canais do evento salvos!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveCategory = async (categoryId: string) => {
    try {
      setSaving(categoryId)
      const category = EVENT_CATEGORIES.find(c => c.id === categoryId)
      if (!category) return
      
      await Promise.all(
        category.events.map(event => {
          const channels = eventChannels[event.key] || DEFAULT_CHANNELS
          return saveConfig(event.key, JSON.stringify(channels))
        })
      )
      toast.success(`Eventos de ${category.label} salvos!`)
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAllEvents = async () => {
    try {
      setSaving('all-events')
      const allSaves = EVENT_CATEGORIES.flatMap(category =>
        category.events.map(event => {
          const channels = eventChannels[event.key] || DEFAULT_CHANNELS
          return saveConfig(event.key, JSON.stringify(channels))
        })
      )
      await Promise.all(allSaves)
      toast.success('Todas as configurações de eventos salvas!')
    } catch {
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(null)
    }
  }

  const handleTestChannel = async (channel: string) => {
    try {
      setTesting(channel)
      const response = await api.post(`/admin/notifications/test/${channel}`)
      if (response.data.success) {
        toast.success(`Teste do ${channel} realizado com sucesso!`)
      } else {
        toast.error(`Falha no teste: ${response.data.message}`)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || `Erro ao testar ${channel}`)
    } finally {
      setTesting(null)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const toggleEventChannel = (eventKey: string, channel: 'email' | 'teams' | 'system') => {
    setEventChannels(prev => ({
      ...prev,
      [eventKey]: {
        ...(prev[eventKey] || DEFAULT_CHANNELS),
        [channel]: !(prev[eventKey]?.[channel] ?? true)
      }
    }))
  }

  const toggleCategoryChannel = (categoryId: string, channel: 'email' | 'teams' | 'system', enabled: boolean) => {
    const category = EVENT_CATEGORIES.find(c => c.id === categoryId)
    if (!category) return
    
    const newEventChannels = { ...eventChannels }
    category.events.forEach(event => {
      newEventChannels[event.key] = {
        ...(newEventChannels[event.key] || DEFAULT_CHANNELS),
        [channel]: enabled
      }
    })
    setEventChannels(newEventChannels)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Configurações de Notificações</h2>
        <button
          onClick={() => loadConfigs()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </button>
      </div>

      {/* Channel Status Overview */}
      {channelsStatus && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'email', label: 'Email', icon: Mail },
            { key: 'teams', label: 'Teams', icon: MessageSquare },
            { key: 'system', label: 'Sistema', icon: Bell }
          ].map(channel => (
            <div key={channel.key} className={`p-4 rounded-xl border ${channelsStatus[channel.key as keyof ChannelsStatus] ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${channelsStatus[channel.key as keyof ChannelsStatus] ? 'bg-green-100' : 'bg-gray-200'}`}>
                  <channel.icon className={`w-5 h-5 ${channelsStatus[channel.key as keyof ChannelsStatus] ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{channel.label}</p>
                  <p className={`text-sm ${channelsStatus[channel.key as keyof ChannelsStatus] ? 'text-green-600' : 'text-gray-500'}`}>
                    {channelsStatus[channel.key as keyof ChannelsStatus] ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email Configuration */}
      <div className={`rounded-xl border transition-all duration-200 ${emailConfig.enabled ? SECTION_STYLES.active : SECTION_STYLES.inactive}`}>
        <div 
          className="px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => toggleSection('email')}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${emailConfig.enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Notificações por Email</h3>
              <p className="text-sm text-gray-500">{emailConfig.enabled ? 'Ativo' : 'Desativado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button
              onClick={(e) => {
                e.stopPropagation()
                setEmailConfig({ ...emailConfig, enabled: !emailConfig.enabled })
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                emailConfig.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="text-gray-400">
              {expandedSections.has('email') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
        
        {expandedSections.has('email') && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Servidor SMTP</label>
                <input
                  type="text"
                  value={emailConfig.smtpHost}
                  onChange={(e) => setEmailConfig({ ...emailConfig, smtpHost: e.target.value })}
                  placeholder="smtp.exemplo.com"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Porta</label>
                <input
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => setEmailConfig({ ...emailConfig, smtpPort: e.target.value })}
                  placeholder="587"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email de Origem</label>
              <input
                type="email"
                value={emailConfig.from}
                onChange={(e) => setEmailConfig({ ...emailConfig, from: e.target.value })}
                placeholder="notificacoes@empresa.com"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              />
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={emailConfig.useTls}
                  onChange={(e) => setEmailConfig({ ...emailConfig, useTls: e.target.checked })}
                  className="peer h-4 w-4 opacity-0 absolute"
                />
                <div className="w-4 h-4 border border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-colors">
                  {emailConfig.useTls && <div className="w-2 h-2 bg-white rounded-sm" />}
                </div>
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Usar TLS (recomendado)</span>
            </label>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveEmail}
                disabled={saving === 'email'}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {saving === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configurações
              </button>
              <button
                onClick={() => handleTestChannel('email')}
                disabled={testing === 'email' || !emailConfig.enabled}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {testing === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Teste
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Teams Configuration */}
      <div className={`rounded-xl border transition-all duration-200 ${teamsConfig.enabled ? SECTION_STYLES.active : SECTION_STYLES.inactive}`}>
        <div 
          className="px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => toggleSection('teams')}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${teamsConfig.enabled ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Microsoft Teams</h3>
              <p className="text-sm text-gray-500">{teamsConfig.enabled ? 'Ativo' : 'Desativado'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setTeamsConfig({ ...teamsConfig, enabled: !teamsConfig.enabled })
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                teamsConfig.enabled ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  teamsConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="text-gray-400">
              {expandedSections.has('teams') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
        
        {expandedSections.has('teams') && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">URL do Webhook</label>
              <input
                type="url"
                value={teamsConfig.webhookUrl}
                onChange={(e) => setTeamsConfig({ ...teamsConfig, webhookUrl: e.target.value })}
                placeholder="https://prod-xx.brazilsouth.logic.azure.com/workflows/..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 focus:bg-white focus:text-gray-900 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveTeams}
                disabled={saving === 'teams'}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {saving === 'teams' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configurações
              </button>
              <button
                onClick={() => handleTestChannel('teams')}
                disabled={testing === 'teams' || !teamsConfig.enabled}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {testing === 'teams' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Teste
              </button>
            </div>
          </div>
        )}
      </div>

      {/* System Notifications */}
      <div className={`rounded-xl border transition-all duration-200 ${systemConfig.enabled ? SECTION_STYLES.active : SECTION_STYLES.inactive}`}>
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${systemConfig.enabled ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Notificações no Sistema</h3>
              <p className="text-sm text-gray-500">Alertas no ícone de sino</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button
              onClick={() => {
                setSystemConfig({ ...systemConfig, enabled: !systemConfig.enabled })
                // Auto-save system config when toggled, or let user save? Original code had button.
                // Keeping it manual save for consistency with others, but maybe auto would be better.
                // Minimalist usually implies "it just works".
                // But let's stick to the pattern: Toggle -> Save button appears? 
                // Creating a simplified save button right here if changed?
                // For now, adhering to the structure: Toggle here enables the save action.
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                systemConfig.enabled ? 'bg-orange-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  systemConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <button
              onClick={handleSaveSystem}
              disabled={saving === 'system'}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Salvar"
            >
              {saving === 'system' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Event Configuration with Per-Channel Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-medium text-gray-900">Gerenciar Eventos</h3>
          <button
            onClick={handleSaveAllEvents}
            disabled={saving === 'all-events'}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving === 'all-events' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Todos
          </button>
        </div>
        
        {/* Legend - Simplified */
        /* <div className="px-4 py-2 bg-gray-50 rounded-lg flex items-center gap-4 text-xs text-gray-500 border border-gray-100">
          <span>Canais:</span>
          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Teams</span>
          <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> Sistema</span>
        </div> */}
        
        {/* Legend */}
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-4 text-xs text-gray-600">
          <span>Canais:</span>
          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Teams</span>
          <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> Sistema</span>
        </div>
        
        <div className="divide-y divide-gray-100">
          {EVENT_CATEGORIES.map(category => {
            const colors = CATEGORY_COLORS[category.color]
            const isExpanded = expandedCategories.has(category.id)
            const CategoryIcon = category.icon
            
            return (
              <div key={category.id}>
                {/* Category Header */}
                <div 
                  className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${isExpanded ? 'border-gray-300 shadow-sm' : 'border-gray-200'}`}
                >
                  <div 
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-gray-50/50' : ''}`}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${colors.bg}`}>
                        <CategoryIcon className={`w-4 h-4 ${colors.icon}`} />
                      </div>
                      <div>
                        <span className={`font-medium text-gray-900`}>{category.label}</span>
                        {!isExpanded && <span className="text-xs text-gray-400 ml-2">{category.events.length}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isExpanded && (
                        <div className="flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
                           <button
                             onClick={() => toggleCategoryChannel(category.id, 'email', true)}
                             className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                             title="Ativar Email para todos"
                           >
                             <Mail className="w-3.5 h-3.5" />
                           </button>
                           <button
                             onClick={() => toggleCategoryChannel(category.id, 'teams', true)}
                             className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                             title="Ativar Teams para todos"
                           >
                             <MessageSquare className="w-3.5 h-3.5" />
                           </button>
                           <button
                             onClick={() => toggleCategoryChannel(category.id, 'system', true)}
                             className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                             title="Ativar Sistema para todos"
                           >
                             <Bell className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      )}
                      
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                
                {/* Category Events with Channel Toggles */}
                {isExpanded && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="text-left py-2 font-medium">Evento</th>
                            <th className="w-12 text-center py-2 font-medium" title="Email">
                              <Mail className="w-3.5 h-3.5 mx-auto text-gray-400" />
                            </th>
                            <th className="w-12 text-center py-2 font-medium" title="Teams">
                              <MessageSquare className="w-3.5 h-3.5 mx-auto text-gray-400" />
                            </th>
                            <th className="w-12 text-center py-2 font-medium" title="Sistema">
                              <Bell className="w-3.5 h-3.5 mx-auto text-gray-400" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {category.events.map(event => {
                            const channels = eventChannels[event.key] || DEFAULT_CHANNELS
                            return (
                              <tr key={event.key} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 text-sm text-gray-600">{event.label}</td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={channels.email}
                                    onChange={() => toggleEventChannel(event.key, 'email')}
                                    className="h-3.5 w-3.5 accent-blue-600 rounded border-gray-300 cursor-pointer"
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={channels.teams}
                                    onChange={() => toggleEventChannel(event.key, 'teams')}
                                    className="h-3.5 w-3.5 accent-purple-600 rounded border-gray-300 cursor-pointer"
                                  />
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={channels.system}
                                    onChange={() => toggleEventChannel(event.key, 'system')}
                                    className="h-3.5 w-3.5 accent-orange-600 rounded border-gray-300 cursor-pointer"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                      <button
                        onClick={() => handleSaveCategory(category.id)}
                        disabled={saving === category.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving === category.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div> // Closing the wrapper div added in previous chunk
            )
          })}
        </div>
      </div>
    </div>
  )
}
