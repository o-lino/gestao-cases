import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Clock, Upload, User as UserIcon } from 'lucide-react'
import { caseService, Case } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'

export function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

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
      loadCase(caseData.id)
    } catch (error) {
      console.error('Failed to update status', error)
    }
  }

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
                  'bg-secondary text-secondary-foreground'}`}>
                {caseData.status === 'DRAFT' && 'Rascunho'}
                {caseData.status === 'SUBMITTED' && 'Enviado'}
                {caseData.status === 'REVIEW' && 'Em Revisão'}
                {caseData.status === 'APPROVED' && 'Aprovado'}
                {caseData.status === 'REJECTED' && 'Rejeitado'}
                {caseData.status === 'CLOSED' && 'Fechado'}
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
            <button
              onClick={() => handleStatusChange('CLOSED')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-600 text-white hover:bg-gray-700 h-10 px-4 py-2"
            >
              Fechar Case
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={cn(
                activeTab === 'variables'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              Variáveis
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={cn(
                activeTab === 'documents'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              Documentos
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={cn(
                activeTab === 'comments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              Comentários
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('ai-insights')}
              className={cn(
                activeTab === 'ai-insights'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              )}
            >
              IA Insights ✨
            </button>
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === 'overview' && <OverviewTab caseData={caseData} />}
          {activeTab === 'variables' && <VariablesTab variables={caseData.variables} />}
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
                <label className="text-sm font-medium text-muted-foreground">Orçamento</label>
                <p className="mt-1 text-sm font-medium">
                  {caseData.budget ? `R$ ${caseData.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </p>
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

function VariablesTab({ variables, caseId }: { variables: any[], caseId?: number }) {
  const [expandedVar, setExpandedVar] = useState<number | null>(null)
  const [searching, setSearching] = useState<number | null>(null)
  const [caseProgress, setCaseProgress] = useState<any>(null)
  const [variableMatches, setVariableMatches] = useState<Record<number, any[]>>({})
  const [loadingProgress, setLoadingProgress] = useState(true)
  
  // Load case progress on mount
  useEffect(() => {
    if (caseId) {
      loadCaseProgress()
    }
  }, [caseId])
  
  const loadCaseProgress = async () => {
    if (!caseId) return
    setLoadingProgress(true)
    try {
      // Dynamic import to avoid circular dependencies
      const { matchingService } = await import('@/services/matchingService')
      const progress = await matchingService.getCaseProgress(caseId)
      setCaseProgress(progress)
      
      // Create a map of variable status from progress
      const statusMap: Record<number, any> = {}
      progress.variables?.forEach((v: any) => {
        statusMap[v.id] = {
          status: v.search_status || 'PENDING',
          matchCount: v.match_count || 0,
          topScore: v.top_score,
          selectedTable: v.selected_table
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
      console.log('Variable matches:', matches)
      // TODO: Open modal with match details
      alert(`Encontrados ${matches.length} matches para esta variável. Ver console para detalhes.`)
    } catch (error) {
      console.error('Failed to get matches:', error)
    }
  }

  if (!variables || variables.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma variável definida para este case.</p>
        <p className="text-sm mt-2">Adicione variáveis ao case para iniciar a busca automática de dados.</p>
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
      {/* Progress Overview */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Progresso da Busca de Dados</h3>
          <span className="text-sm text-muted-foreground">
            {variables.length} variáveis
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all" 
            style={{ width: '40%' }} // TODO: Calculate from real progress
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>2 pendentes</span>
          <span>1 em análise</span>
          <span>1 aprovada</span>
        </div>
      </div>

      {/* Variables List */}
      <div className="space-y-3">
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
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedVar(isExpanded ? null : i)}
              >
                {/* Status Indicator */}
                <div className={cn(
                  "w-3 h-3 rounded-full shrink-0",
                  matchInfo.status === 'APPROVED' ? "bg-green-500" :
                  matchInfo.status === 'MATCHED' ? "bg-blue-500" :
                  matchInfo.status === 'OWNER_REVIEW' ? "bg-yellow-500" :
                  "bg-gray-400"
                )} />

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{v.variable_name || v.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                      {v.variable_type === 'text' && 'Texto'}
                      {v.variable_type === 'number' && 'Número'}
                      {v.variable_type === 'date' && 'Data'}
                      {v.variable_type === 'boolean' && 'Booleano'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {v.variable_value || v.value || 'Sem valor definido'}
                  </p>
                </div>

                {/* Match Badge */}
                <div className="flex items-center gap-2">
                  {isSearching ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
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
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSearch(v.id)
                      }}
                      className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                      Buscar Dados
                    </button>
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
                  </div>
                  
                  {matchInfo.status !== 'PENDING' && (
                    <div className="pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Tabelas Sugeridas:</p>
                      <div className="text-sm text-muted-foreground">
                        {matchInfo.matchCount} tabela(s) encontrada(s) com score máximo de {Math.round(matchInfo.topScore * 100)}%
                      </div>
                      <button className="mt-2 text-sm text-primary hover:underline">
                        Ver detalhes →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
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

  return (
    <div className="bg-card rounded-lg border p-6 shadow-sm">
      <div className="flow-root">
        <ul role="list" className="-mb-8">
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum histórico disponível.</div>
          ) : (
            history.map((event, eventIdx) => (
              <li key={event.id}>
                <div className="relative pb-8">
                  {eventIdx !== history.length - 1 ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                        <Clock className="h-5 w-5 text-white" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm text-gray-500">
                          {event.action} <span className="font-medium text-gray-900">por Usuário {event.collaborator_id}</span>
                        </p>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('pt-BR')}</time>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))
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
