import { useState, useEffect } from 'react'
import { Zap, Play, Pause, Settings, Plus, Trash2, ChevronRight, CheckCircle } from 'lucide-react'
import { Case, CaseStatus } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'

type TriggerType = 
  | 'status_change'
  | 'deadline_approaching'
  | 'field_value'

type ActionType =
  | 'change_status'
  | 'send_notification'
  | 'add_tag'
  | 'assign_user'
  | 'create_task'

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: {
    type: TriggerType
    config: Record<string, any>
  }
  conditions: Array<{
    field: string
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than'
    value: any
  }>
  actions: Array<{
    type: ActionType
    config: Record<string, any>
  }>
  executionCount: number
  lastExecuted?: Date
}

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'auto-1',
    name: 'Alerta 3 dias antes do prazo',
    enabled: true,
    trigger: { type: 'deadline_approaching', config: { days: 3 } },
    conditions: [],
    actions: [{ type: 'send_notification', config: { type: 'deadline_reminder' } }],
    executionCount: 0,
  },
]

// Hook to manage automation rules
export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    const saved = localStorage.getItem('automationRules')
    return saved ? JSON.parse(saved) : DEFAULT_RULES
  })

  useEffect(() => {
    localStorage.setItem('automationRules', JSON.stringify(rules))
  }, [rules])

  const addRule = (rule: Omit<AutomationRule, 'id' | 'executionCount'>) => {
    setRules(prev => [...prev, { ...rule, id: `rule-${Date.now()}`, executionCount: 0 }])
  }

  const updateRule = (id: string, updates: Partial<AutomationRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  return { rules, addRule, updateRule, deleteRule, toggleRule }
}

// Automation Engine - evaluates rules against case changes
export function evaluateRules(
  rules: AutomationRule[],
  caseData: Case,
  event: { type: TriggerType; data?: any }
): Array<{ rule: AutomationRule; actions: ActionType[] }> {
  const triggeredRules: Array<{ rule: AutomationRule; actions: ActionType[] }> = []

  rules.filter(r => r.enabled).forEach(rule => {
    // Check if trigger matches
    let triggerMatches = false
    
    switch (rule.trigger.type) {
      case 'status_change':
        if (event.type === 'status_change') {
          triggerMatches = true
        }
        break
      case 'deadline_approaching':
        if (caseData.end_date) {
          const daysUntil = Math.ceil(
            (new Date(caseData.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
          if (daysUntil <= rule.trigger.config.days && daysUntil > 0) {
            triggerMatches = true
          }
        }
        break
      case 'field_value':
        const fieldValue = caseData[rule.trigger.config.field as keyof Case]
        if (fieldValue === rule.trigger.config.value) {
          triggerMatches = true
        }
        break
    }

    if (!triggerMatches) return

    // Check conditions
    const conditionsMet = rule.conditions.every(condition => {
      const fieldValue = caseData[condition.field as keyof Case]
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value
        case 'contains':
          return String(fieldValue).includes(condition.value)
        case 'greater_than':
          return Number(fieldValue) > condition.value
        case 'less_than':
          return Number(fieldValue) < condition.value
        default:
          return false
      }
    })

    if (conditionsMet || rule.conditions.length === 0) {
      triggeredRules.push({
        rule,
        actions: rule.actions.map(a => a.type),
      })
    }
  })

  return triggeredRules
}

// Automation Rules Panel UI
export function AutomationRulesPanel() {
  const toast = useToast()
  const { rules, toggleRule, deleteRule } = useAutomationRules()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleDelete = (id: string) => {
    if (confirm('Excluir esta regra de automação?')) {
      deleteRule(id)
      toast.success('Regra excluída')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Regras de Automação
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Nova Regra
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          Nenhuma regra de automação configurada
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                "flex items-center gap-4 p-4 border rounded-lg",
                !rule.enabled && "opacity-60"
              )}
            >
              <button
                onClick={() => toggleRule(rule.id)}
                className={cn(
                  "p-2 rounded-lg",
                  rule.enabled ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                )}
              >
                {rule.enabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{rule.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span className="px-2 py-0.5 bg-muted rounded">
                    {rule.trigger.type.replace('_', ' ')}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  {rule.actions.map((action, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {action.type.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-right">
                <div>Executado {rule.executionCount}x</div>
                {rule.lastExecuted && (
                  <div>Última: {new Date(rule.lastExecuted).toLocaleDateString()}</div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Quick automation suggestions based on case patterns
export function AutomationSuggestions({ cases }: { cases: Case[] }) {
  const suggestions: Array<{title: string; description: string; rule: {trigger: {type: TriggerType; config: any}; action: string}}> = []
  
  // Suggest based on patterns
  const overdueCount = cases.filter(c => 
    c.end_date && new Date(c.end_date) < new Date() && c.status !== 'CLOSED'
  ).length
  if (overdueCount > 0) {
    suggestions.push({
      title: 'Alertas de prazo',
      description: `${overdueCount} cases em atraso. Configure alertas automáticos.`,
      rule: {
        trigger: { type: 'deadline_approaching' as TriggerType, config: { days: 3 } },
        action: 'send_notification',
      },
    })
  }

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Sugestões de Automação</h4>
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-sm">{s.title}</div>
            <div className="text-xs text-muted-foreground">{s.description}</div>
          </div>
          <button className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded">
            Criar
          </button>
        </div>
      ))}
    </div>
  )
}
