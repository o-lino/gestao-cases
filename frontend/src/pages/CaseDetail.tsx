import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Clock, Upload, User as UserIcon, X, PlusCircle, Info, ExternalLink, Database, Folder, User, AlertTriangle, XCircle, FileQuestion, CheckCircle, ChevronDown, Eye, MessageSquare, History, Sparkles } from 'lucide-react'
import { caseService, Case, CaseVariable } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'
import { VariableModal } from '@/components/cases/VariableModal'
import { VariableDetailModal } from '@/components/cases/VariableDetailModal'
import { InvolvementCard } from '@/components/cases/InvolvementCard'
import { InvolvementRequestModal } from '@/components/cases/InvolvementRequestModal'
import { InvolvementSetDateModal } from '@/components/cases/InvolvementSetDateModal'
import { InvolvementCompletionModal } from '@/components/cases/InvolvementCompletionModal'
import involvementService, { Involvement } from '@/services/involvementService'

export function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (id) {
      loadCase(parseInt(id))
    }
  }, [id])

  const loadCase = async (caseId: number) => {
    try {
      const data = await caseService.getById(caseId)
      setCaseData(data)
    } catch (error) {
      console.error('Failed to load case', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!caseData) return
    try {
      // Use transition instead of updateStatus based on caseService definition
      await caseService.transition(caseData.id, newStatus)
      toast.success(`Status alterado para ${newStatus === 'CLOSED' ? 'Fechado' : newStatus === 'CANCELLED' ? 'Cancelado' : newStatus}`)
      loadCase(caseData.id)
    } catch (error: any) {
      console.error('Failed to update status', error)
      toast.error(error?.response?.data?.detail || 'Erro ao alterar status')
    }
  }

  const handleCancelCase = async () => {
    if (!caseData) return
    setIsCancelling(true)
    try {
      await caseService.cancel(caseData.id, cancelReason || undefined)
      toast.success('Case cancelado com sucesso!')
      setShowCancelModal(false)
      setCancelReason('')
      loadCase(caseData.id)
    } catch (error: any) {
      console.error('Failed to cancel case', error)
      toast.error(error?.response?.data?.detail || 'Erro ao cancelar case')
    } finally {
      setIsCancelling(false)
    }
  }

  // Calculate if case can be closed (all active variables must be approved)
  const activeVariables = caseData?.variables?.filter(v => !v.is_cancelled) || []
  const allVariablesApproved = activeVariables.length === 0 || 
    activeVariables.every(v => v.search_status === 'APPROVED')
  const pendingVariablesCount = activeVariables.filter(v => v.search_status !== 'APPROVED').length

  const canApprove = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-bold">Case não encontrado</h2>
        <Link to="/cases" className="text-primary hover:underline">
          Voltar para a lista
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/cases"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{caseData.title}</h1>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <span>Case #{caseData.id}</span>
              <span>•</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent 
                ${caseData.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                  caseData.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 
                  caseData.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' : 
                  caseData.status === 'CANCELLED' ? 'bg-red-200 text-red-900' : 
                  'bg-secondary text-secondary-foreground'}`}>
                {caseData.status === 'DRAFT' && 'Rascunho'}
                {caseData.status === 'SUBMITTED' && 'Enviado'}
                {caseData.status === 'REVIEW' && 'Em Revisão'}
                {caseData.status === 'APPROVED' && 'Aprovado'}
                {caseData.status === 'REJECTED' && 'Rejeitado'}
                {caseData.status === 'CLOSED' && 'Fechado'}
                {caseData.status === 'CANCELLED' && 'Cancelado'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {caseData.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('SUBMITTED')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Enviar para Revisão
            </button>
          )}
          {caseData.status === 'SUBMITTED' && canApprove && (
            <button
              onClick={() => handleStatusChange('REVIEW')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Iniciar Revisão
            </button>
          )}
          {caseData.status === 'REVIEW' && canApprove && (
            <>
              <button
                onClick={() => handleStatusChange('APPROVED')}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2"
              >
                Aprovar
              </button>
              <button
                onClick={() => handleStatusChange('REJECTED')}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2"
              >
                Rejeitar
              </button>
            </>
          )}
          {caseData.status === 'REJECTED' && (
            <button
              onClick={() => handleStatusChange('DRAFT')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-yellow-600 text-white hover:bg-yellow-700 h-10 px-4 py-2"
            >
              Reabrir para Edição
            </button>
          )}
          {caseData.status === 'APPROVED' && canApprove && (
            <div className="relative group">
              <button
                onClick={() => allVariablesApproved && handleStatusChange('CLOSED')}
                disabled={!allVariablesApproved}
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 py-2",
                  allVariablesApproved 
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                )}
              >
                Fechar Case
              </button>
              {!allVariablesApproved && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {pendingVariablesCount} variável(eis) não aprovada(s)
                </div>
              )}
            </div>
          )}
          {/* Cancel Case Button - available for all statuses except CLOSED and CANCELLED */}
          {caseData.status !== 'CLOSED' && caseData.status !== 'CANCELLED' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-red-300 text-red-600 hover:bg-red-50 h-10 px-4 py-2 gap-2"
            >
              <XCircle className="h-4 w-4" />
              Cancelar Case
            </button>
          )}
        </div>
      </div>

      {/* Cancel Case Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold">Cancelar Case</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Tem certeza que deseja cancelar o case <strong>{caseData.title}</strong>?
              Esta ação irá cancelar automaticamente todas as variáveis ativas.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Motivo do cancelamento (opcional):</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
                placeholder="Descreva o motivo do cancelamento..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelCase}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Mobile: Dropdown elegante */}
        <div className="md:hidden">
          <label htmlFor="tabs-mobile" className="sr-only">Selecionar seção</label>
          <div className="relative">
            <select
              id="tabs-mobile"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
              className="block w-full appearance-none rounded-lg border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-gray-900 shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="overview">📋 Visão Geral</option>
              <option value="variables">📊 Variáveis</option>
              <option value="documents">📁 Documentos</option>
              <option value="comments">💬 Comentários</option>
              <option value="history">🕐 Histórico</option>
              <option value="ai-insights">✨ IA Insights</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* Desktop: Tabs tradicionais */}
        <div className="hidden md:block border-b border-gray-200">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <Eye className="h-4 w-4" />
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={cn(
                activeTab === 'variables'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <Database className="h-4 w-4" />
              Variáveis
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={cn(
                activeTab === 'documents'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <FileText className="h-4 w-4" />
              Documentos
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={cn(
                activeTab === 'comments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Comentários
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <History className="h-4 w-4" />
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('ai-insights')}
              className={cn(
                activeTab === 'ai-insights'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'group inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors'
              )}
            >
              <Sparkles className="h-4 w-4" />
              IA Insights
            </button>
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === 'overview' && <OverviewTab caseData={caseData} />}
          {activeTab === 'variables' && <VariablesTab variables={caseData.variables} caseId={caseData.id} caseStatus={caseData.status} userId={user?.id} caseCreatedById={caseData.created_by} onUpdate={() => loadCase(caseData.id)} />}
          {activeTab === 'documents' && <DocumentsTab caseId={caseData.id} />}
          {activeTab === 'comments' && <CommentsTab caseId={caseData.id} />}
          {activeTab === 'history' && <HistoryTab caseId={caseData.id} />}
          {activeTab === 'ai-insights' && <AIInsightsTab caseData={caseData} />}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ caseData }: { caseData: Case }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Detalhes do Projeto</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descrição</label>
              <p className="mt-1 text-sm">{caseData.description || 'Nenhuma descrição fornecida.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                <p className="mt-1 text-sm font-medium">{caseData.client_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Solicitante</label>
                <p className="mt-1 text-sm font-medium">{caseData.requester_email || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Macro Case</label>
                <p className="mt-1 text-sm font-medium">{caseData.macro_case || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data de Início</label>
                <p className="mt-1 text-sm font-medium">
                  {caseData.start_date ? new Date(caseData.start_date).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Data de Término</label>
                <p className="mt-1 text-sm font-medium">
                  {caseData.end_date ? new Date(caseData.end_date).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Contexto e Justificativa</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contexto</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.context || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Necessidade</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.necessity || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Impacto e Alcance</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Impacto Esperado</label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{caseData.impact || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Jornada Impactada</label>
              <p className="mt-1 text-sm">{caseData.impacted_journey || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Segmento Impactado</label>
              <p className="mt-1 text-sm">{caseData.impacted_segment || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Clientes Impactados</label>
              <p className="mt-1 text-sm">{caseData.impacted_customers || '-'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Informações do Sistema</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Criado por</span>
              <span className="text-sm font-medium">Usuário {caseData.created_by}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Criado em</span>
              <span className="text-sm font-medium">{new Date(caseData.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Última atualização</span>
              <span className="text-sm font-medium">{new Date(caseData.updated_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VariablesTab({ variables, caseId, caseStatus, userId, caseCreatedById, onUpdate }: { variables: any[], caseId?: number, caseStatus?: string, userId?: number, caseCreatedById?: number, onUpdate?: () => void }) {
  // Permission check: only case requester can approve/cancel
  const isRequester = userId && caseCreatedById && userId === caseCreatedById
  const [expandedVar, setExpandedVar] = useState<number | null>(null)
  const [searching, setSearching] = useState<number | null>(null)
  const [caseProgress, setCaseProgress] = useState<any>(null)
  const [variableMatches, setVariableMatches] = useState<Record<number, any>>({})
  const [loadingProgress, setLoadingProgress] = useState(true)
  
  // Variable management state
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [cancelModalVariable, setCancelModalVariable] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [selectedVariables, setSelectedVariables] = useState<number[]>([])
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [detailVariable, setDetailVariable] = useState<any>(null)
  const toast = useToast()
  
  const isEditable = caseStatus !== 'CLOSED' && caseStatus !== 'CANCELLED'
  
  // Filter out cancelled variables for display - defined early so functions can use them
  const activeVariables = variables.filter((v: any) => !v.is_cancelled)
  const cancelledVariables = variables.filter((v: any) => v.is_cancelled)
  const isAllSelected = activeVariables.length > 0 && selectedVariables.length === activeVariables.filter((v: any) => v.id).length
  
  // Calculate how many selected variables are actually approvable (in REQUESTER_REVIEW status)
  // This is needed to only show the Approve button when there are variables ready for requester approval
  const getSelectedApprovableCount = () => {
    return selectedVariables.filter(varId => {
      const matchInfo = variableMatches[varId]
      // Variable must be in REQUESTER_REVIEW status (owner already approved, waiting for requester)
      return matchInfo?.status === 'REQUESTER_REVIEW'
    }).length
  }
  const approvableCount = getSelectedApprovableCount()
  
  // Load case progress on mount
  useEffect(() => {
    if (caseId) {
      loadCaseProgress()
    }
  }, [caseId, variables])
  
  const loadCaseProgress = async () => {
    if (!caseId) return
    setLoadingProgress(true)
    try {
      // Dynamic import to avoid circular dependencies
      const { matchingService } = await import('@/services/matchingService')
      const progress = await matchingService.getCaseProgress(caseId)
      setCaseProgress(progress)
      
      // Create a map of variable status from progress with extended fields
      const statusMap: Record<number, any> = {}
      progress.variables?.forEach((v: any) => {
        statusMap[v.id] = {
          status: v.search_status || 'PENDING',
          matchCount: v.match_count || 0,
          topScore: v.top_score,
          selectedTable: v.selected_table,
          // Extended fields
          concept: v.concept,
          desiredLag: v.desired_lag,
          selectedTableId: v.selected_table_id,
          selectedTableDomain: v.selected_table_domain,
          selectedTableOwnerName: v.selected_table_owner_name,
          selectedTableDescription: v.selected_table_description,
          selectedTableFullPath: v.selected_table_full_path,
          matchStatus: v.match_status,
          isPendingOwner: v.is_pending_owner,
          isApproved: v.is_approved
        }
      })
      setVariableMatches(statusMap as any)
    } catch (error) {
      console.error('Failed to load case progress:', error)
    } finally {
      setLoadingProgress(false)
    }
  }
  
  const getMatchStatus = (variable: any) => {
    const cached = variableMatches[variable.id]
    if (cached) {
      return cached
    }
    // Default status from variable's search_status field
    return {
      status: variable.search_status || 'PENDING',
      matchCount: 0,
      topScore: undefined,
      concept: variable.concept,
      desiredLag: variable.desired_lag,
      isPendingOwner: false,
      isApproved: false
    }
  }

  const buildVariableDetail = (v: any, matchInfo: any) => {
    return {
      id: v.id,
      variable_name: v.variable_name || v.name,
      variable_type: v.variable_type,
      concept: matchInfo.concept || v.concept,
      desired_lag: matchInfo.desiredLag || v.desired_lag,
      search_status: matchInfo.status,
      match_count: matchInfo.matchCount || 0,
      top_score: matchInfo.topScore,
      selected_table: matchInfo.selectedTable,
      selected_table_id: matchInfo.selectedTableId,
      selected_table_domain: matchInfo.selectedTableDomain,
      selected_table_owner_name: matchInfo.selectedTableOwnerName,
      selected_table_description: matchInfo.selectedTableDescription,
      selected_table_full_path: matchInfo.selectedTableFullPath,
      match_status: matchInfo.matchStatus,
      is_pending_owner: matchInfo.isPendingOwner || false,
      is_pending_requester: matchInfo.status === 'REQUESTER_REVIEW',
      is_approved: matchInfo.isApproved || false
    }
  }

  const handleSearch = async (variableId: number) => {
    setSearching(variableId)
    try {
      const { matchingService } = await import('@/services/matchingService')
      await matchingService.searchMatches(variableId)
      await loadCaseProgress() // Reload progress after search
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(null)
    }
  }
  
  const handleViewDetails = async (variableId: number) => {
    try {
      const { matchingService } = await import('@/services/matchingService')
      const matches = await matchingService.getVariableMatches(variableId)
      // Find the variable and show its details in the modal
      const variable = variables.find((v: any) => v.id === variableId)
      if (variable) {
        const matchInfo = getMatchStatus(variable)
        setDetailVariable(buildVariableDetail(variable, matchInfo))
      }
    } catch (error) {
      toast.error('Erro ao carregar detalhes da variável')
    }
  }

  const handleAddVariable = async (variable: CaseVariable) => {
    if (!caseId) return
    setIsSubmitting(true)
    try {
      await caseService.addVariable(caseId, variable)
      toast.success('Variável adicionada com sucesso!')
      setShowVariableModal(false)
      onUpdate?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Erro ao adicionar variável')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelVariable = async () => {
    if (!caseId || !cancelModalVariable?.id) return
    setIsSubmitting(true)
    try {
      await caseService.cancelVariable(caseId, cancelModalVariable.id, cancelReason || undefined)
      toast.success('Variável cancelada com sucesso!')
      setCancelModalVariable(null)
      setCancelReason('')
      onUpdate?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Erro ao cancelar variável')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle selection of a single variable
  const toggleSelectVariable = (variableId: number) => {
    if (!variableId) return // Guard clause for invalid IDs
    
    setSelectedVariables(prev => 
      prev.includes(variableId) 
        ? prev.filter(id => id !== variableId)
        : [...prev, variableId]
    )
  }

  // Toggle select all active variables
  const toggleSelectAll = () => {
    // Only select variables with valid IDs
    const activeVariableIds = activeVariables
      .map((v: any) => v.id)
      .filter((id: any) => typeof id === 'number' && id > 0)
      
    if (selectedVariables.length > 0 && selectedVariables.length === activeVariableIds.length) {
      setSelectedVariables([])
    } else {
      setSelectedVariables(activeVariableIds)
    }
  }

  // Bulk cancel handler
  const handleBulkCancel = async () => {
    if (!caseId || selectedVariables.length === 0) return
    setIsSubmitting(true)
    try {
      // Cancel each selected variable
      for (const variableId of selectedVariables) {
        await caseService.cancelVariable(caseId, variableId, cancelReason || undefined)
      }
      toast.success(`${selectedVariables.length} variável(is) cancelada(s) com sucesso!`)
      setShowBulkCancelModal(false)
      setSelectedVariables([])
      setCancelReason('')
      onUpdate?.()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Erro ao cancelar variáveis')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk approve handler
  const handleBulkApprove = async () => {
    if (!caseId || selectedVariables.length === 0) return
    
    // Filter variables that can be approved
    const approvableVariables = variables.filter((v: any) => 
      selectedVariables.includes(v.id) && 
      !v.is_cancelled &&
      // Check if variable has a match that can be confirmed
      // We need to find the match ID for each variable. 
      // Since we don't have direct access to match IDs here without searching,
      // we might need to rely on the backend to handle "approve best match" or similar.
      // However, usually approval implies confirming the current status/match.
      // For now, let's assume we can confirm if it's in a specific state, OR
      // strictly speaking, the "Confirm Indicação" (Requester Response -> APPROVE) 
      // requires a match_id.
      // If we don't have match IDs easily available in the list view (we only have match counts),
      // we might need to fetch them or assume the backend can handle "approve current best match".
      // Let's check if we have match info. variableMatches map has status but not match ID.
      // We will try to approve using the variable ID if the backend supports it, 
      // or we might need to iterate and fetch matches.
      // Based on matchingService, we need matchId to call requesterRespond.
      // But maybe we can add a helper in caseService/matchingService to "approve variable best match".
      true 
    )

    if (approvableVariables.length === 0) {
      toast.error('Nenhuma variável selecionada pode ser aprovada no momento.')
      return
    }

    if (!confirm(`Deseja aprovar ${approvableVariables.length} variáveis selecionadas? Isso confirmará a melhor indicação disponível.`)) {
      return
    }

    setIsSubmitting(true)
    try {
      let successCount = 0
      const { matchingService } = await import('@/services/matchingService')
      
      for (const variable of approvableVariables) {
        try {
          // 1. Get matches for this variable to find the best one
          const matches = await matchingService.getVariableMatches(variable.id)
          
          // 2. Find match that is awaiting requester confirmation
          // Only PENDING_REQUESTER matches can be approved by the requester
          const approvableMatch = matches.find((m: any) => 
            m.status === 'PENDING_REQUESTER'
          )
          
          if (approvableMatch) {
            await matchingService.requesterRespond(approvableMatch.id, {
              response_type: 'APPROVE'
            })
            successCount++
          } else {
             console.warn(`No match with PENDING_REQUESTER status found for variable ${variable.id}`)
          }
        } catch (err) {
          console.error(`Failed to approve variable ${variable.id}`, err)
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} variável(is) aprovada(s) com sucesso!`)
        setSelectedVariables([])
        onUpdate?.()
      } else {
        toast.warning('Não foi possível aprovar as variáveis selecionadas. Verifique se existem matches sugeridos.')
      }
    } catch (error: any) {
      toast.error('Erro ao processar aprovações em massa')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!variables || variables.length === 0) {
    return (
      <div className="space-y-4">
        {isEditable && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowVariableModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar Variável
            </button>
          </div>
        )}
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma variável definida para este case.</p>
          <p className="text-sm mt-2">Adicione variáveis ao case para iniciar a busca automática de dados.</p>
        </div>
        
        {/* Variable Modal */}
        {showVariableModal && (
          <VariableModal
            onClose={() => setShowVariableModal(false)}
            onAdd={handleAddVariable}
          />
        )}
      </div>
    )
  }
  
  // Calculate progress from caseProgress or fallback
  const progressPercent = caseProgress?.progress_percent ?? 0
  const pendingCount = caseProgress?.pending ?? variables.length
  const matchedCount = caseProgress?.matched ?? 0
  const approvedCount = caseProgress?.approved ?? 0

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      {isEditable && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowVariableModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar Variável
          </button>
        </div>
      )}

      {/* Progress Overview */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Progresso da Busca de Dados</h3>
          <span className="text-sm text-muted-foreground">
            {activeVariables.length} variáveis ativas
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{pendingCount} pendentes</span>
          <span>{matchedCount} em análise</span>
          <span>{approvedCount} aprovadas</span>
        </div>
      </div>

      {/* Variables List */}
      <div className="space-y-3">
        {/* Bulk Actions Header */}
        {isEditable && activeVariables.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-sm font-medium">
                {isAllSelected ? 'Desmarcar todas' : 'Selecionar todas'} ({activeVariables.length})
              </span>
            </label>
            
            {/* Cancel button - requester can cancel at any time */}
            {selectedVariables.length > 0 && isRequester && (
              <div className="flex items-center gap-2">
                {/* Approve button - only show when there are variables waiting for requester approval */}
                {approvableCount > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                    title="Confirmar indicação para as variáveis selecionadas (apenas variáveis aguardando sua aprovação)"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar {approvableCount} ({approvableCount} aguardando)
                  </button>
                )}
                <button
                  onClick={() => setShowBulkCancelModal(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Cancelar {selectedVariables.length} selecionada(s)
                </button>
              </div>
            )}
          </div>
        )}

        {variables.map((v, i) => {
          const matchInfo = getMatchStatus(v)
          const isExpanded = expandedVar === i
          const isSearching = searching === v.id
          
          return (
            <div 
              key={v.id || i} 
              className="rounded-lg border bg-card overflow-hidden"
            >
              {/* Variable Header */}
              <div 
                className="flex flex-col md:flex-row md:items-center gap-3 p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedVar(isExpanded ? null : i)}
              >
                {/* Row 1: Checkbox + Status + Name (Mobile) */}
                <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                  {/* Selection Checkbox for bulk operations - FIRST */}
                  {isEditable && !v.is_cancelled && (
                    <div className="pt-1 md:pt-0 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedVariables.includes(v.id)}
                        onChange={() => toggleSelectVariable(v.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer block"
                        title="Selecionar para ação em massa"
                      />
                    </div>
                  )}

                  {/* Status Indicator */}
                  <div className={cn(
                    "w-3 h-3 rounded-full shrink-0 mt-1.5 md:mt-0",
                    matchInfo.status === 'APPROVED' ? "bg-green-500" :
                    matchInfo.status === 'MATCHED' ? "bg-blue-500" :
                    matchInfo.status === 'OWNER_REVIEW' ? "bg-yellow-500" :
                    matchInfo.status === 'PENDING_INVOLVEMENT' ? "bg-orange-500" :
                    "bg-gray-400"
                  )} />

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm md:text-base break-words line-clamp-2 md:line-clamp-1">{v.variable_name || v.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-muted rounded-full shrink-0">
                        {v.variable_type === 'text' && 'Texto'}
                        {v.variable_type === 'number' && 'Número'}
                        {v.variable_type === 'date' && 'Data'}
                        {v.variable_type === 'boolean' && 'Booleano'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {v.variable_value || v.value || 'Sem valor definido'}
                    </p>
                  </div>
                </div>

                {/* Row 2 (Mobile) / Column (Desktop): Match Badge */}
                <div className="flex items-center gap-2 pl-8 md:pl-0 w-full md:w-auto justify-between md:justify-end">
                  {isSearching ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      <Clock className="h-3 w-3 animate-spin" />
                      Buscando...
                    </span>
                  ) : matchInfo.status === 'MATCHED' ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      {matchInfo.matchCount} match{matchInfo.matchCount > 1 ? 'es' : ''}
                      <span className="font-semibold">
                        ({Math.round(matchInfo.topScore * 100)}%)
                      </span>
                    </span>
                  ) : matchInfo.status === 'APPROVED' ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      ✓ Aprovada
                    </span>
                  ) : matchInfo.status === 'OWNER_REVIEW' ? (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                      Aguardando Owner
                    </span>
                  ) : matchInfo.status === 'PENDING_INVOLVEMENT' ? (
                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                      <FileQuestion className="h-3 w-3" />
                      Envolvimento Pendente
                    </span>
                  ) : matchInfo.status === 'SEARCHING' || matchInfo.status === 'AI_SEARCHING' ? (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Em Busca...
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Aguardando Busca Automática
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t p-4 bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="ml-2 font-medium capitalize">{v.variable_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="ml-2 font-medium">{v.variable_value || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Conceito:</span>
                      <span className="ml-2 font-medium">{matchInfo.concept || v.concept || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Defasagem:</span>
                      <span className="ml-2 font-medium">{matchInfo.desiredLag || v.desired_lag || '-'}</span>
                    </div>
                  </div>
                  
                  {/* Table Info Section */}
                  {matchInfo.selectedTable && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        Tabela Sugerida
                      </p>
                      <div className="bg-white rounded-lg border p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{matchInfo.selectedTable}</p>
                            {matchInfo.selectedTableDescription && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{matchInfo.selectedTableDescription}</p>
                            )}
                          </div>
                          {matchInfo.topScore && (
                            <span className="text-sm font-bold text-green-600">
                              {Math.round(matchInfo.topScore * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {matchInfo.selectedTableDomain && (
                            <span className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {matchInfo.selectedTableDomain}
                            </span>
                          )}
                          {matchInfo.selectedTableOwnerName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {matchInfo.selectedTableOwnerName}
                            </span>
                          )}
                        </div>
                        {/* Status indicators */}
                        <div className="flex items-center gap-2">
                          {matchInfo.isPendingOwner && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                              Pendente aprovação Owner
                            </span>
                          )}
                          {matchInfo.isApproved && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                              ✓ Aprovada para uso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {matchInfo.status !== 'PENDING' && !matchInfo.selectedTable && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Tabelas Sugeridas:</p>
                      <div className="text-sm text-muted-foreground">
                        {matchInfo.matchCount} tabela(s) encontrada(s) com score máximo de {Math.round(matchInfo.topScore * 100)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Ver Detalhes Button */}
                  <div className="pt-2 flex justify-end">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailVariable(buildVariableDetail(v, matchInfo))
                      }}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
                    >
                      <Info className="h-4 w-4" />
                      Ver Detalhes Completos
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Variable Modal */}
      {showVariableModal && (
        <VariableModal
          onClose={() => setShowVariableModal(false)}
          onAdd={handleAddVariable}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalVariable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Cancelar Variável</h3>
            <p className="text-muted-foreground mb-4">
              Deseja cancelar a variável <strong>{cancelModalVariable.variable_name}</strong>?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Motivo (opcional):</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                placeholder="Descreva o motivo do cancelamento..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setCancelModalVariable(null)
                  setCancelReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCancelVariable}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cancel Modal */}
      {showBulkCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <X className="h-5 w-5 text-orange-600" />
              Cancelar Variáveis Selecionadas
            </h3>
            <p className="text-muted-foreground mb-4">
              Você está prestes a cancelar <strong className="text-orange-600">{selectedVariables.length} variável(is)</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Motivo do cancelamento <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border rounded-lg p-2 min-h-[100px]"
                placeholder="Informe o motivo do cancelamento..."
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBulkCancelModal(false)
                  setCancelReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={handleBulkCancel}
                disabled={isSubmitting || !cancelReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Cancelando...' : `Cancelar ${selectedVariables.length} variável(is)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variable Detail Modal */}
      {detailVariable && (
        <VariableDetailModal
          variable={detailVariable}
          onClose={() => setDetailVariable(null)}
        />
      )}

      {/* Show cancelled variables if any */}
      {cancelledVariables.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Variáveis Canceladas ({cancelledVariables.length})</h4>
          <div className="space-y-2">
            {cancelledVariables.map((v: any, i: number) => (
              <div key={v.id || `cancelled-${i}`} className="rounded-lg border bg-muted/30 p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="line-through text-muted-foreground">{v.variable_name}</span>
                  {v.cancellation_reason && (
                    <span className="text-xs text-muted-foreground">- {v.cancellation_reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VariableRenderer({ type, value }: { type: string, value: any }) {
  switch (type) {
    case 'boolean':
      return (
        <span className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          value === 'true' || value === true ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        )}>
          {value === 'true' || value === true ? 'Sim' : 'Não'}
        </span>
      )
    case 'date':
      return <span>{new Date(value).toLocaleDateString('pt-BR')}</span>
    default:
      return <span>{value}</span>
  }
}

function DocumentsTab({ caseId }: { caseId: number }) {
  const toast = useToast()
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [caseId])

  const loadDocuments = async () => {
    try {
      const data = await caseService.getDocuments(caseId)
      setDocuments(data)
    } catch (error) {
      console.error('Failed to load documents', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await caseService.uploadDocument(caseId, file)
      await loadDocuments()
    } catch (error) {
      console.error('Failed to upload document', error)
      toast.error('Erro ao enviar documento')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-foreground">Documentos</h3>
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label
              htmlFor="file-upload"
              className={cn(
                "cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Enviando...' : 'Enviar Documento'}
            </label>
          </div>
        </div>
        
        {documents.length > 0 ? (
          <ul role="list" className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                <div className="flex w-0 flex-1 items-center">
                  <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="ml-2 w-0 flex-1 truncate">{doc.filename}</span>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <span className="font-medium text-indigo-600 hover:text-indigo-500">
                    {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum documento enviado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentsTab({ caseId }: { caseId: number }) {
  const toast = useToast()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [caseId])

  const loadComments = async () => {
    try {
      const data = await caseService.getComments(caseId)
      setComments(data)
    } catch (error) {
      console.error('Failed to load comments', error)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      await caseService.createComment(caseId, newComment)
      setNewComment('')
      await loadComments()
    } catch (error) {
      console.error('Failed to add comment', error)
      toast.error('Erro ao adicionar comentário')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <form onSubmit={handleAddComment} className="mb-6">
          <label htmlFor="comment" className="sr-only">Adicionar comentário</label>
          <div className="flex gap-4">
            <textarea
              id="comment"
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 self-end"
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhum comentário ainda.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-6 w-6 text-gray-500" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Usuário {comment.created_by}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryTab({ caseId }: { caseId: number }) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [caseId])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await caseService.getHistory(caseId)
      setHistory(data)
    } catch (error) {
      console.error('Failed to load history', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando histórico...</div>
      </div>
    )
  }

  // Helper function to get action description and icon color
  // Using Itaú Unibanco color palette: orange, blue, gray, green, amber (gold)
  const getActionInfo = (event: any) => {
    const actionMap: Record<string, { label: string; color: string; description: string }> = {
      'CREATE': { label: 'Case Criado', color: 'bg-green-600', description: event.changes?.action || 'Case foi criado' },
      'UPDATE': { label: 'Atualização', color: 'bg-blue-600', description: 'Dados do case foram atualizados' },
      'TRANSITION': { label: 'Mudança de Status', color: 'bg-amber-500', description: `Status alterado de ${event.changes?.status?.old || '?'} para ${event.changes?.status?.new || '?'}` },
      'ADD_VARIABLE': { label: 'Variável Adicionada', color: 'bg-orange-500', description: event.changes?.variable_name ? `Variável "${event.changes.variable_name}" adicionada` : 'Nova variável adicionada' },
      'CANCEL_VARIABLE': { label: 'Variável Cancelada', color: 'bg-gray-600', description: event.changes?.variable_name ? `Variável "${event.changes.variable_name}" cancelada` : 'Variável cancelada' },
      'DELETE_VARIABLE': { label: 'Variável Excluída', color: 'bg-gray-800', description: event.changes?.variable_name ? `Variável "${event.changes.variable_name}" excluída permanentemente` : 'Variável excluída' },
      'CANCEL': { label: 'Case Cancelado', color: 'bg-gray-700', description: event.changes?.reason ? `Case cancelado: ${event.changes.reason}` : 'Case foi cancelado' },
    }
    return actionMap[event.action_type] || { label: event.action_type, color: 'bg-gray-500', description: 'Ação registrada' }
  }

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum histórico disponível.</div>
          ) : (
            history.map((event: any, eventIdx: number) => {
              const actionInfo = getActionInfo(event)
              return (
                <li key={event.id}>
                  <div className="relative pb-8">
                    {eventIdx !== history.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className={`h-8 w-8 rounded-full ${actionInfo.color} flex items-center justify-center ring-8 ring-white`}>
                          <Clock className="h-4 w-4 text-white" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${actionInfo.color} text-white`}>
                              {actionInfo.label}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              por {event.actor_name || 'Usuário'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {actionInfo.description}
                          </p>
                          {/* Show detailed changes for UPDATE actions */}
                          {event.action_type === 'UPDATE' && event.changes && Object.keys(event.changes).length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              {Object.entries(event.changes).map(([field, change]: [string, any]) => (
                                <div key={field}>
                                  <strong>{field}:</strong> {change.old} → {change.new}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Show additional details for variable operations */}
                          {(event.action_type === 'ADD_VARIABLE' || event.action_type === 'CANCEL_VARIABLE') && event.changes && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              {event.changes.variable_type && <div><strong>Tipo:</strong> {event.changes.variable_type}</div>}
                              {event.changes.product && event.changes.product !== 'N/A' && <div><strong>Produto:</strong> {event.changes.product}</div>}
                              {event.changes.priority && event.changes.priority !== 'N/A' && <div><strong>Prioridade:</strong> {event.changes.priority}</div>}
                              {event.changes.reason && event.changes.reason !== 'Não informado' && <div><strong>Motivo:</strong> {event.changes.reason}</div>}
                            </div>
                          )}
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('pt-BR')}</time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}

function AIInsightsTab({ caseData }: { caseData: Case }) {
  const [summary, setSummary] = useState<string>('')
  const [riskAssessment, setRiskAssessment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAIInsights()
  }, [caseData.id])

  const loadAIInsights = async () => {
    setLoading(true)
    try {
      const [summaryData, riskData] = await Promise.all([
        caseService.getSummary(caseData.id),
        caseService.getRiskAssessment(caseData.id)
      ])
      setSummary(summaryData.summary || 'Resumo não disponível')
      setRiskAssessment(riskData)
    } catch (error) {
      console.error('Failed to load AI insights', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Carregando análise de IA...</div>
      </div>
    )
  }

  const riskScore = riskAssessment?.risk_score || 0
  const riskLevel = riskAssessment?.risk_level || 'BAIXO'
  const riskColor = riskLevel === 'ALTO' ? 'text-red-600' : riskLevel === 'MÉDIO' ? 'text-yellow-600' : 'text-green-600'

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">🤖</span> Resumo Inteligente
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gerado automaticamente pela IaraGenAI
            </p>
            <div className="bg-muted/50 p-4 rounded-md text-sm leading-relaxed">
              {summary}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📊</span> Análise de Risco
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score de Risco</span>
              <span className={`text-2xl font-bold ${riskColor}`}>{riskScore}/100</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${riskLevel === 'ALTO' ? 'bg-red-600' : riskLevel === 'MÉDIO' ? 'bg-yellow-600' : 'bg-green-600'}`} 
                style={{ width: `${riskScore}%` }}
              ></div>
            </div>

            {riskAssessment?.factors && riskAssessment.factors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Fatores Identificados:</h4>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {riskAssessment.factors.map((factor: string, index: number) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
