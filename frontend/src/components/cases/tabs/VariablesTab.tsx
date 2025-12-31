import { useEffect, useState } from 'react'
import { FileText, Clock, X, PlusCircle, Info, Database, Folder, User, FileQuestion, CheckCircle } from 'lucide-react'
import { caseService, CaseVariable } from '@/services/caseService'
import { useToast } from '@/components/common/Toast'
import { cn } from '@/lib/utils'
import { VariableModal } from '@/components/cases/VariableModal'
import { VariableDetailModal } from '@/components/cases/VariableDetailModal'

interface VariablesTabProps {
  variables: any[]
  caseId?: number
  caseStatus?: string
  userId?: number
  caseCreatedById?: number
  onUpdate?: () => void
}

export function VariablesTab({ variables, caseId, caseStatus, userId, caseCreatedById, onUpdate }: VariablesTabProps) {
  // Permission check: only case requester can approve/cancel
  const isRequester = userId && caseCreatedById && userId === caseCreatedById
  const [expandedVar, setExpandedVar] = useState<number | null>(null)

  const [caseProgress, setCaseProgress] = useState<any>(null)
  const [variableMatches, setVariableMatches] = useState<Record<number, any>>({})

  
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
                  {matchInfo.status === 'MATCHED' ? (
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

export default VariablesTab
