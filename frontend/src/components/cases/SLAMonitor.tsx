import { useState, useEffect, useCallback } from 'react'
import { format, differenceInHours, differenceInDays, addDays, isPast, isFuture } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, AlertTriangle, AlertCircle, CheckCircle, Bell, X } from 'lucide-react'
import { Case } from '@/services/caseService'
import { cn } from '@/lib/utils'

export interface SLAConfig {
  id: string
  name: string
  status: string
  warningHours: number
  criticalHours: number
  enabled: boolean
}

export interface SLAAlert {
  caseId: number
  caseTitle: string
  type: 'warning' | 'critical' | 'overdue'
  message: string
  hoursRemaining?: number
  deadline?: Date
}

const DEFAULT_SLA_CONFIGS: SLAConfig[] = [
  { id: 'review', name: 'Análise', status: 'REVIEW', warningHours: 24, criticalHours: 48, enabled: true },
  { id: 'approval', name: 'Aprovação', status: 'SUBMITTED', warningHours: 48, criticalHours: 72, enabled: true },
  { id: 'draft', name: 'Rascunho', status: 'DRAFT', warningHours: 72, criticalHours: 168, enabled: false },
]

// Hook to manage SLA configurations
export function useSLAConfig() {
  const [configs, setConfigs] = useState<SLAConfig[]>(() => {
    const saved = localStorage.getItem('slaConfigs')
    return saved ? JSON.parse(saved) : DEFAULT_SLA_CONFIGS
  })

  useEffect(() => {
    localStorage.setItem('slaConfigs', JSON.stringify(configs))
  }, [configs])

  const updateConfig = (id: string, updates: Partial<SLAConfig>) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const resetToDefaults = () => {
    setConfigs(DEFAULT_SLA_CONFIGS)
  }

  return { configs, updateConfig, resetToDefaults }
}

// Hook to calculate SLA alerts for cases
export function useSLAAlerts(cases: Case[]): SLAAlert[] {
  const { configs } = useSLAConfig()
  
  return cases.flatMap(caseData => {
    const config = configs.find(c => c.status === caseData.status && c.enabled)
    if (!config) return []

    const createdAt = new Date(caseData.created_at)
    const warningDeadline = addDays(createdAt, config.warningHours / 24)
    const criticalDeadline = addDays(createdAt, config.criticalHours / 24)
    const hoursElapsed = differenceInHours(new Date(), createdAt)

    if (hoursElapsed >= config.criticalHours) {
      return [{
        caseId: caseData.id,
        caseTitle: caseData.title,
        type: 'overdue' as const,
        message: `SLA crítico expirado! Case está há ${Math.floor(hoursElapsed / 24)} dias em ${caseData.status}`,
        hoursRemaining: 0,
        deadline: criticalDeadline,
      }]
    }

    if (hoursElapsed >= config.warningHours) {
      const hoursRemaining = config.criticalHours - hoursElapsed
      return [{
        caseId: caseData.id,
        caseTitle: caseData.title,
        type: 'critical' as const,
        message: `SLA crítico em ${Math.floor(hoursRemaining)} horas`,
        hoursRemaining,
        deadline: criticalDeadline,
      }]
    }

    const hoursUntilWarning = config.warningHours - hoursElapsed
    if (hoursUntilWarning <= 12) {
      return [{
        caseId: caseData.id,
        caseTitle: caseData.title,
        type: 'warning' as const,
        message: `SLA de atenção em ${Math.floor(hoursUntilWarning)} horas`,
        hoursRemaining: config.criticalHours - hoursElapsed,
        deadline: warningDeadline,
      }]
    }

    return []
  })
}

// SLA Badge Component
interface SLABadgeProps {
  caseData: Case
  showLabel?: boolean
}

export function SLABadge({ caseData, showLabel = false }: SLABadgeProps) {
  const { configs } = useSLAConfig()
  const config = configs.find(c => c.status === caseData.status && c.enabled)
  
  if (!config) return null

  const createdAt = new Date(caseData.created_at)
  const hoursElapsed = differenceInHours(new Date(), createdAt)
  
  let status: 'ok' | 'warning' | 'critical' | 'overdue' = 'ok'
  let Icon = CheckCircle
  let colorClass = 'text-green-500'
  let label = 'Dentro do SLA'

  if (hoursElapsed >= config.criticalHours) {
    status = 'overdue'
    Icon = AlertCircle
    colorClass = 'text-red-500'
    label = 'SLA Expirado'
  } else if (hoursElapsed >= config.warningHours) {
    status = 'critical'
    Icon = AlertTriangle
    colorClass = 'text-orange-500'
    label = 'SLA Crítico'
  } else if (config.warningHours - hoursElapsed <= 12) {
    status = 'warning'
    Icon = Clock
    colorClass = 'text-yellow-500'
    label = 'Atenção SLA'
  }

  const hoursRemaining = config.criticalHours - hoursElapsed
  const timeLabel = hoursRemaining > 0 
    ? `${Math.floor(hoursRemaining / 24)}d ${hoursRemaining % 24}h restantes`
    : `${Math.abs(Math.floor(hoursRemaining / 24))}d ${Math.abs(hoursRemaining % 24)}h em atraso`

  return (
    <div
      className={cn("flex items-center gap-1", colorClass)}
      title={`${label} - ${timeLabel}`}
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span className="text-xs">{label}</span>}
    </div>
  )
}

// SLA Alerts Panel
interface SLAAlertsPanelProps {
  alerts: SLAAlert[]
  onCaseClick?: (caseId: number) => void
  onDismiss?: (caseId: number) => void
}

export function SLAAlertsPanel({ alerts, onCaseClick, onDismiss }: SLAAlertsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  
  const visibleAlerts = alerts.filter(a => !dismissed.has(a.caseId))
  
  if (visibleAlerts.length === 0) return null

  const handleDismiss = (caseId: number) => {
    setDismissed(prev => new Set([...prev, caseId]))
    onDismiss?.(caseId)
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-500" />
          Alertas de SLA ({visibleAlerts.length})
        </h3>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {visibleAlerts.map(alert => (
          <div
            key={alert.caseId}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              alert.type === 'overdue' && "bg-red-500/10 border border-red-500/30",
              alert.type === 'critical' && "bg-orange-500/10 border border-orange-500/30",
              alert.type === 'warning' && "bg-yellow-500/10 border border-yellow-500/30"
            )}
          >
            <div className="flex items-center gap-3">
              {alert.type === 'overdue' && <AlertCircle className="h-5 w-5 text-red-500" />}
              {alert.type === 'critical' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
              {alert.type === 'warning' && <Clock className="h-5 w-5 text-yellow-500" />}
              
              <div>
                <button
                  onClick={() => onCaseClick?.(alert.caseId)}
                  className="font-medium text-sm hover:underline"
                >
                  #{alert.caseId} - {alert.caseTitle}
                </button>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(alert.caseId)}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// SLA Configuration Panel (for admin/settings)
export function SLAConfigPanel() {
  const { configs, updateConfig, resetToDefaults } = useSLAConfig()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Configuração de SLA</h3>
        <button
          onClick={resetToDefaults}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Restaurar padrões
        </button>
      </div>

      <div className="space-y-3">
        {configs.map(config => (
          <div key={config.id} className="flex items-center gap-4 p-3 border rounded-lg">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig(config.id, { enabled: e.target.checked })}
              className="h-4 w-4"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{config.name}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{config.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                Atenção:
                <input
                  type="number"
                  value={config.warningHours}
                  onChange={(e) => updateConfig(config.id, { warningHours: parseInt(e.target.value) || 24 })}
                  className="w-16 ml-1 px-2 py-1 border rounded text-sm"
                  disabled={!config.enabled}
                />h
              </label>
              
              <label className="text-xs text-muted-foreground">
                Crítico:
                <input
                  type="number"
                  value={config.criticalHours}
                  onChange={(e) => updateConfig(config.id, { criticalHours: parseInt(e.target.value) || 48 })}
                  className="w-16 ml-1 px-2 py-1 border rounded text-sm"
                  disabled={!config.enabled}
                />h
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
