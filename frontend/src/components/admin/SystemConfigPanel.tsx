import { useState, useEffect } from 'react'
import { 
  Settings, 
  Save, 
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpCircle,
  Bell
} from 'lucide-react'
import adminConfigService, { 
  SystemConfig, 
  ConfigSummary 
} from '@/services/adminConfigService'
import { useToast } from '@/components/common/Toast'

// Translation Maps
const CONFIG_LABELS: Record<string, string> = {
  // Approval
  'approval_sla_hours': 'SLA de Aprovação (Horas)',
  'case_approval_required': 'Exigir Aprovação de Gestor',
  
  // Escalation
  'escalation_enabled': 'Escalada Automática',
  'escalation_sla_hours': 'SLA para Escalada (Horas)',
  'escalation_max_level': 'Nível Máximo de Escalada',
  'escalation_reminder_hours': 'Antecedência do Lembrete (Horas)',
  
  // System/Other
  'system_maintenance_mode': 'Modo de Manutenção',
  'allow_guest_access': 'Permitir Acesso Visitante',
}

const CATEGORY_LABELS: Record<string, string> = {
  'approval': 'Regras de Aprovação',
  'escalation': 'Regras de Escalada',
  'notification': 'Notificações',
  'system': 'Sistema',
  'security': 'Segurança'
}

export function SystemConfigPanel() {
  const toast = useToast()
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [summary, setSummary] = useState<ConfigSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const [configList, configSummary] = await Promise.all([
        adminConfigService.listConfigs(),
        adminConfigService.getConfigSummary()
      ])
      setConfigs(configList)
      setSummary(configSummary)
      
      // Initialize edit values
      const values: Record<string, string> = {}
      configList.forEach(c => {
        values[c.configKey] = c.configValue
      })
      setEditValues(values)
    } catch (error) {
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (config: SystemConfig) => {
    const newValue = editValues[config.configKey]
    if (newValue === config.configValue) return
    
    try {
      setSaving(config.configKey)
      await adminConfigService.setConfig(config.configKey, newValue)
      toast.success('Configuração atualizada com sucesso!')
      loadConfigs()
    } catch (error) {
      toast.error('Erro ao salvar configuração')
    } finally {
      setSaving(null)
    }
  }

  const handleInitialize = async () => {
    try {
      const result = await adminConfigService.initializeDefaults()
      toast.success(result.message)
      loadConfigs()
    } catch (error) {
      toast.error('Erro ao inicializar padrões')
    }
  }

  const getConfigIcon = (key: string) => {
    if (key.includes('sla') || key.includes('hours')) return <Clock className="w-4 h-4" />
    if (key.includes('approval')) return <CheckCircle className="w-4 h-4" />
    if (key.includes('escalation')) return <ArrowUpCircle className="w-4 h-4" />
    if (key.includes('reminder')) return <Bell className="w-4 h-4" />
    return <Settings className="w-4 h-4" />
  }

  const categories = [...new Set(configs.map(c => c.category))]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleInitialize}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Restaurar Padrões
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <span className="font-semibold">Resumo de Aprovação</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 text-sm">Requer aprovação</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${summary.approval.caseApprovalRequired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {summary.approval.caseApprovalRequired ? 'Sim' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 text-sm">SLA Padrão</span>
                <span className="text-sm font-medium text-gray-900">{summary.approval.approvalSlaHours}h</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <ArrowUpCircle className="w-5 h-5" />
              </div>
              <span className="font-semibold">Resumo de Escalada</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 text-sm">Escalada Automática</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${summary.escalation.escalationEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {summary.escalation.escalationEnabled ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 text-sm">SLA de Escalada</span>
                <span className="text-sm font-medium text-gray-900">{summary.escalation.escalationSlaHours}h</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 text-sm">Nível Máximo</span>
                <span className="text-sm font-medium text-gray-900">{summary.escalation.escalationMaxLevel} (Diretor)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Sections */}
      <div className="grid gap-6">
        {categories.map(category => (
          <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                {CATEGORY_LABELS[category] || category}
              </h3>
            </div>
            
            <div className="divide-y divide-gray-100">
              {configs.filter(c => c.category === category).map(config => (
                <div key={config.id} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 w-full md:flex-1">
                    <div className="mt-1 text-gray-400 shrink-0">
                      {getConfigIcon(config.configKey)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {CONFIG_LABELS[config.configKey] || config.configKey}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{config.description}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                    {config.configType === 'boolean' ? (
                      <select
                        value={editValues[config.configKey] || 'false'}
                        onChange={(e) => setEditValues({...editValues, [config.configKey]: e.target.value})}
                        className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer hover:border-gray-300 w-full md:w-auto"
                      >
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    ) : config.configType === 'number' ? (
                      <input
                        type="number"
                        value={editValues[config.configKey] || ''}
                        onChange={(e) => setEditValues({...editValues, [config.configKey]: e.target.value})}
                        className="h-9 w-full md:w-24 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 text-right focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                      />
                    ) : (
                      <input
                        type="text"
                        value={editValues[config.configKey] || ''}
                        onChange={(e) => setEditValues({...editValues, [config.configKey]: e.target.value})}
                        className="h-9 w-full md:w-48 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                      />
                    )}
                    
                    {editValues[config.configKey] !== config.configValue && (
                      <button
                        onClick={() => handleSave(config)}
                        disabled={saving === config.configKey}
                        className="h-9 w-9 shrink-0 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
                        title="Salvar alterações"
                      >
                        {saving === config.configKey ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {configs.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Nenhuma configuração encontrada</h3>
          <p className="text-gray-500 mb-6">O sistema precisa ser inicializado com as configurações padrão.</p>
          <button
            onClick={handleInitialize}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
          >
            Inicializar Configurações
          </button>
        </div>
      )}
    </div>
  )
}
