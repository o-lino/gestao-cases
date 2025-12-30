import { useState, useEffect } from 'react'
import { Check, Clock, User, Search, AlertCircle, ChevronRight, ArrowRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

// Variable status workflow
export type VariableStatus = 
  | 'PENDING'
  | 'AI_SEARCHING'
  | 'SEARCHING'
  | 'MATCHED'
  | 'OWNER_REVIEW'
  | 'OWNER_APPROVED'
  | 'OWNER_REJECTED'
  | 'REQUESTER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ALTERNATIVE'
  | 'NO_MATCH'

interface WorkflowStep {
  id: VariableStatus
  label: string
  description: string
  icon: React.ComponentType<any>
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'PENDING', label: 'Pendente', description: 'Aguardando busca', icon: Clock },
  { id: 'SEARCHING', label: 'Buscando', description: 'Procurando dados no catálogo', icon: Search },
  { id: 'MATCHED', label: 'Match Encontrado', description: 'Tabela sugerida encontrada', icon: Check },
  { id: 'OWNER_REVIEW', label: 'Validação Owner', description: 'Aguardando dono dos dados', icon: User },
  { id: 'REQUESTER_REVIEW', label: 'Validação Solicitante', description: 'Aguardando sua confirmação', icon: User },
  { id: 'APPROVED', label: 'Aprovado', description: 'Dado confirmado e disponível', icon: Check },
]

const STATUS_CONFIG: Record<VariableStatus, { color: string; bgColor: string; label: string }> = {
  PENDING: { color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Aguardando Busca' },
  AI_SEARCHING: { color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Busca IA...' },
  SEARCHING: { color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Buscando...' },
  MATCHED: { color: 'text-purple-500', bgColor: 'bg-purple-100', label: 'Match Encontrado' },
  OWNER_REVIEW: { color: 'text-orange-500', bgColor: 'bg-orange-100', label: 'Aguardando Owner' },
  OWNER_APPROVED: { color: 'text-teal-500', bgColor: 'bg-teal-100', label: 'Owner Aprovou' },
  OWNER_REJECTED: { color: 'text-red-500', bgColor: 'bg-red-100', label: 'Owner Rejeitou' },
  REQUESTER_REVIEW: { color: 'text-yellow-500', bgColor: 'bg-yellow-100', label: 'Sua Validação' },
  APPROVED: { color: 'text-green-500', bgColor: 'bg-green-100', label: 'Aprovado' },
  REJECTED: { color: 'text-red-500', bgColor: 'bg-red-100', label: 'Rejeitado' },
  CANCELLED: { color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Cancelado' },
  ALTERNATIVE: { color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Buscando Alternativa' },
  NO_MATCH: { color: 'text-red-500', bgColor: 'bg-red-100', label: 'Sem Match' },
}

interface VariableWorkflowStepperProps {
  currentStatus: VariableStatus
  className?: string
}

export function VariableWorkflowStepper({ currentStatus, className }: VariableWorkflowStepperProps) {
  const getCurrentStepIndex = () => {
    const index = WORKFLOW_STEPS.findIndex(s => s.id === currentStatus)
    return index >= 0 ? index : 0
  }

  const currentIndex = getCurrentStepIndex()

  return (
    <div className={cn("flex items-center justify-between", className)}>
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = step.icon
        const isCompleted = index < currentIndex
        const isCurrent = step.id === currentStatus || 
          (currentStatus === 'OWNER_APPROVED' && step.id === 'OWNER_REVIEW') ||
          (currentStatus === 'REQUESTER_REVIEW' && step.id === 'REQUESTER_REVIEW')
        const isPending = index > currentIndex

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/30",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className={cn(
                "text-xs mt-2 text-center max-w-[80px]",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            
            {index < WORKFLOW_STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-2",
                index < currentIndex ? "bg-green-500" : "bg-muted"
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Status Badge
export function VariableStatusBadge({ status }: { status: VariableStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
      config.bgColor, config.color
    )}>
      {config.label}
    </span>
  )
}

// Variable Progress Card
interface VariableProgressCardProps {
  variable: {
    id: number
    name: string
    value?: string
    status: VariableStatus
    matchedTable?: { name: string; owner: string }
  }
  onAction?: (action: string) => void
  isExpanded?: boolean
}

export function VariableProgressCard({ variable, onAction, isExpanded = false }: VariableProgressCardProps) {
  const [expanded, setExpanded] = useState(isExpanded)
  const config = STATUS_CONFIG[variable.status] || STATUS_CONFIG.PENDING

  const getAvailableActions = () => {
    switch (variable.status) {
      case 'PENDING':
      case 'AI_SEARCHING':
      case 'SEARCHING':
        // Search is now automatic - no manual actions available
        return []
      case 'MATCHED':
        return [
          { id: 'select', label: 'Enviar para Validação', primary: true },
          { id: 'search-more', label: 'Buscar Mais' },
        ]
      case 'OWNER_REJECTED':
        return [{ id: 'search-alternative', label: 'Buscar Alternativa', primary: true }]
      case 'REQUESTER_REVIEW':
        return [
          { id: 'approve', label: 'Confirmar Dado', primary: true },
          { id: 'reject', label: 'Solicitar Alternativa' },
        ]
      default:
        return []
    }
  }

  const actions = getAvailableActions()

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{variable.name}</span>
            <VariableStatusBadge status={variable.status} />
          </div>
          {variable.value && (
            <p className="text-sm text-muted-foreground mt-1">
              Valor solicitado: {variable.value}
            </p>
          )}
        </div>
        
        <ChevronRight className={cn(
          "h-5 w-5 text-muted-foreground transition-transform",
          expanded && "rotate-90"
        )} />
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Workflow Stepper */}
          <VariableWorkflowStepper currentStatus={variable.status} />

          {/* Match Info */}
          {variable.matchedTable && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Tabela Sugerida</p>
              <p className="text-sm">{variable.matchedTable.name}</p>
              <p className="text-xs text-muted-foreground">
                Owner: {variable.matchedTable.owner}
              </p>
            </div>
          )}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex gap-2">
              {actions.map(action => (
                <button
                  key={action.id}
                  onClick={() => onAction?.(action.id)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-lg flex items-center gap-2",
                    action.primary
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  )}
                >
                  {action.id === 'search' && <Search className="h-4 w-4" />}
                  {action.id === 'approve' && <Check className="h-4 w-4" />}
                  {action.id.includes('alternative') && <RotateCcw className="h-4 w-4" />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Case Progress Overview
interface CaseProgressOverviewProps {
  variables: Array<{
    id: number
    name: string
    status: VariableStatus
  }>
}

export function CaseProgressOverview({ variables }: CaseProgressOverviewProps) {
  const stats = {
    total: variables.length,
    pending: variables.filter(v => v.status === 'PENDING').length,
    inProgress: variables.filter(v => 
      ['SEARCHING', 'MATCHED', 'OWNER_REVIEW', 'REQUESTER_REVIEW'].includes(v.status)
    ).length,
    approved: variables.filter(v => v.status === 'APPROVED').length,
    rejected: variables.filter(v => 
      ['REJECTED', 'CANCELLED', 'NO_MATCH'].includes(v.status)
    ).length,
  }

  const completionPct = stats.total > 0 
    ? Math.round(((stats.approved + stats.rejected) / stats.total) * 100)
    : 0

  return (
    <div className="bg-card border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Progresso das Variáveis</h3>
        <span className="text-2xl font-bold">{completionPct}%</span>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-muted rounded-full overflow-hidden mb-4">
        <div className="h-full flex">
          <div 
            className="bg-green-500 transition-all" 
            style={{ width: `${(stats.approved / stats.total) * 100}%` }}
          />
          <div 
            className="bg-yellow-500 transition-all" 
            style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
          />
          <div 
            className="bg-red-500 transition-all" 
            style={{ width: `${(stats.rejected / stats.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">Pendentes</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-500">{stats.inProgress}</div>
          <div className="text-xs text-muted-foreground">Em Andamento</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
          <div className="text-xs text-muted-foreground">Aprovadas</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
          <div className="text-xs text-muted-foreground">Rejeitadas</div>
        </div>
      </div>
    </div>
  )
}
