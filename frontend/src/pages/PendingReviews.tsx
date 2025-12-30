import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Clock, FileText, Check, ChevronDown, ChevronUp, 
  Inbox, Send, Eye, Tag, Calendar, Loader2, CheckCircle2, History, XCircle, Database
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageLayout } from '@/components/common/PageLayout'
import { caseService, Case, CaseVariable } from '@/services/caseService'
import { matchingService, PendingOwnerAction } from '@/services/matchingService'
import { useAuth } from '@/context/AuthContext'

type Tab = 'owner' | 'requester' | 'variables' | 'history'

export function PendingReviews() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('owner')
  const [cases, setCases] = useState<Case[]>([])
  const [pendingOwnerActions, setPendingOwnerActions] = useState<PendingOwnerAction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    loadCases()
  }, [])

  useEffect(() => {
    if (tab === 'variables') {
      loadPendingOwnerActions()
    }
  }, [tab])

  const loadCases = async () => {
    setLoading(true)
    try {
      const allCases = await caseService.getAll()
      setCases(allCases)
    } catch (e) {
      console.error('Failed to load cases')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingOwnerActions = async () => {
    setLoading(true)
    try {
      const actions = await matchingService.getPendingOwnerActions()
      setPendingOwnerActions(actions)
    } catch (e) {
      console.error('Failed to load pending owner actions')
    } finally {
      setLoading(false)
    }
  }

  // Cases waiting for my approval (I am the owner/approver)
  const casesToReview = cases.filter(c => 
    c.status === 'SUBMITTED' && 
    c.requester_email !== user?.email
  )

  // My cases that are in review (I am the requester)
  const myCasesInReview = cases.filter(c => 
    c.requester_email === user?.email && 
    ['REVIEW', 'SUBMITTED'].includes(c.status)
  )

  // History: Resolved cases (approved, rejected, closed, cancelled)
  const resolvedCases = cases.filter(c => 
    ['APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED'].includes(c.status) &&
    (c.requester_email === user?.email)
  )


  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'SUBMITTED': 'bg-blue-100 text-blue-700',
      'REVIEW': 'bg-purple-100 text-purple-700',
      'APPROVED': 'bg-green-100 text-green-700',
      'REJECTED': 'bg-red-100 text-red-700',
      'DRAFT': 'bg-yellow-100 text-yellow-700',
      'CLOSED': 'bg-gray-100 text-gray-700',
      'CANCELLED': 'bg-gray-200 text-gray-600',
    }
    const labels: Record<string, string> = {
      'SUBMITTED': 'Enviado',
      'REVIEW': 'Em Revisão',
      'APPROVED': 'Aprovado',
      'REJECTED': 'Rejeitado',
      'DRAFT': 'Rascunho',
      'CLOSED': 'Fechado',
      'CANCELLED': 'Cancelado',
    }
    return (
      <span className={cn('px-3 py-1 text-xs rounded-full font-semibold', colors[status] || 'bg-gray-100')}>
        {labels[status] || status}
      </span>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Select which cases to show based on selected tab
  const getCasesToShow = () => {
    switch (tab) {
      case 'owner':
        return casesToReview
      case 'requester':
        return myCasesInReview
      case 'variables':
        // Variables tab uses pendingOwnerActions, not cases
        return []
      case 'history':
        return resolvedCases
      default:
        return []
    }
  }

  const casesToShow = getCasesToShow()

  // Get empty state message based on tab
  const getEmptyStateMessage = () => {
    switch (tab) {
      case 'owner':
        return {
          title: 'Tudo em dia!',
          message: 'Não há cases aguardando sua aprovação.',
          icon: <Check className="h-8 w-8 text-green-500" />,
          bgColor: 'bg-green-50'
        }
      case 'requester':
        return {
          title: 'Sem pendências',
          message: 'Suas solicitações não estão pendentes de revisão.',
          icon: <Send className="h-8 w-8 text-blue-500" />,
          bgColor: 'bg-blue-50'
        }
      case 'variables':
        return {
          title: 'Sem variáveis pendentes',
          message: 'Não há variáveis aguardando sua ação.',
          icon: <FileText className="h-8 w-8 text-purple-500" />,
          bgColor: 'bg-purple-50'
        }
      case 'history':
        return {
          title: 'Sem histórico',
          message: 'Nenhuma solicitação resolvida encontrada.',
          icon: <History className="h-8 w-8 text-gray-500" />,
          bgColor: 'bg-gray-50'
        }
    }
  }

  const emptyState = getEmptyStateMessage()

  const tabs = [
    { 
      id: 'owner', 
      label: 'Para Minha Aprovação', 
      icon: Inbox
    },
    { 
      id: 'requester', 
      label: 'Minhas Solicitações', 
      icon: Send
    },
    { 
      id: 'variables', 
      label: 'Variáveis Pendentes', 
      icon: FileText
    },
    { 
      id: 'history', 
      label: 'Histórico', 
      icon: History
    }
  ]

  return (
    <PageLayout
      title="Pendências"
      subtitle="Gerencie cases e variáveis aguardando sua ação"
      icon={Clock}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => setTab(id as Tab)}
    >
      <div className="space-y-6">
        {/* Summary Cards - Statistics Only */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Inbox className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{casesToReview.length}</p>
            <p className="text-sm text-gray-500">Para Aprovar</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Send className="h-5 w-5 text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{myCasesInReview.length}</p>
            <p className="text-sm text-gray-500">Minhas em Revisão</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{pendingOwnerActions.length}</p>
            <p className="text-sm text-gray-500">Variáveis Pendentes</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{resolvedCases.length}</p>
            <p className="text-sm text-gray-500">Resolvidos</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-3" />
              <p className="text-sm text-gray-500">Carregando pendências...</p>
            </div>
          ) : tab === 'variables' ? (
            // Render pending owner actions for Variables tab
            pendingOwnerActions.length === 0 ? (
              <div className="text-center py-12">
                <div className={cn("inline-flex items-center justify-center w-16 h-16 rounded-full mb-4", emptyState.bgColor)}>
                  {emptyState.icon}
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{emptyState.title}</h2>
                <p className="text-gray-500">{emptyState.message}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                {pendingOwnerActions.map((action) => (
                  <div
                    key={action.match_id}
                    className="p-4 md:p-5 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Mobile Layout (< md) */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 text-xs rounded-full font-semibold bg-purple-100 text-purple-700">
                          Aguardando Ação
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {action.created_at ? formatDate(action.created_at) : '-'}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-800 text-base mb-1 line-clamp-2 leading-tight">
                          {action.variable_name}
                        </h3>
                        <p className="text-sm text-gray-500">{action.case_title || 'Sem case'}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-col text-xs text-gray-500">
                          <span className="font-medium text-purple-600">{action.table_display_name}</span>
                          <span>{action.requester_email}</span>
                        </div>
                        
                        <Link
                          to={`/cases/${action.case_id}?tab=variables&variable=${action.variable_id}`}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all active:scale-95"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Analisar
                        </Link>
                      </div>
                    </div>

                    {/* Desktop Layout (>= md) */}
                    <div className="hidden md:flex items-center gap-4">
                      <div className="shrink-0">
                        <span className="px-3 py-1 text-xs rounded-full font-semibold bg-purple-100 text-purple-700">
                          Aguardando Ação
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Tag className="h-4 w-4 text-purple-500" />
                          <span className="font-semibold text-gray-800 truncate text-lg">{action.variable_name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>Case: {action.case_title || 'N/A'}</span>
                          <span>Tabela: {action.table_display_name}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {action.created_at ? formatDate(action.created_at) : '-'}
                          </span>
                        </div>
                      </div>

                      <Link
                        to={`/cases/${action.case_id}?tab=variables&variable=${action.variable_id}`}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 transition-all transform hover:scale-[1.02] shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                        Analisar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : casesToShow.length === 0 ? (
            <div className="text-center py-12">
              <div className={cn("inline-flex items-center justify-center w-16 h-16 rounded-full mb-4", emptyState.bgColor)}>
                {emptyState.icon}
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{emptyState.title}</h2>
              <p className="text-gray-500">{emptyState.message}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-sm">
              {casesToShow.map((caseItem, index) => (
                <div
                  key={caseItem.id}
                  className="group bg-white hover:bg-gray-50/50 transition-colors"
                >
                  {/* Card Header */}
                  <div
                    className="p-4 md:p-5 cursor-pointer hover:bg-white transition-colors"
                    onClick={() => setExpandedId(expandedId === caseItem.id ? null : caseItem.id)}
                  >
                    {/* Mobile Layout (< md) */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-center justify-between">
                        {getStatusBadge(caseItem.status)}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDate(caseItem.created_at)}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-800 text-base mb-1 line-clamp-2 leading-tight">
                          {caseItem.title}
                        </h3>
                        <p className="text-sm text-gray-500">{caseItem.client_name || 'Sem cliente'}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="flex items-center gap-1 text-sm font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-md">
                          <FileText className="h-3.5 w-3.5" />
                          {caseItem.variables?.length || 0} vars
                        </span>
                        
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/cases/${caseItem.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all active:scale-95"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {tab === 'history' ? 'Ver' : 'Analisar'}
                          </Link>
                          <div className="p-1.5 text-gray-400 bg-gray-50 rounded-lg">
                            {expandedId === caseItem.id ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout (>= md) */}
                    <div className="hidden md:flex items-center gap-4">
                      <div className="shrink-0">
                        {getStatusBadge(caseItem.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800 truncate text-lg">{caseItem.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>{caseItem.client_name || 'Sem cliente'}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(caseItem.created_at)}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-purple-600">
                            <FileText className="h-3.5 w-3.5" />
                            {caseItem.variables?.length || 0} variáveis
                          </span>
                        </div>
                      </div>

                      <Link
                        to={`/cases/${caseItem.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30 transition-all transform hover:scale-[1.02] shrink-0"
                      >
                        <Eye className="h-4 w-4" />
                        {tab === 'history' ? 'Ver Detalhes' : 'Analisar'}
                      </Link>

                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        {expandedId === caseItem.id ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === caseItem.id && (
                    <div className="border-t border-gray-100 bg-white p-5">
                      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                        <div>
                          <span className="text-gray-500 block mb-0.5">Solicitante:</span>
                          <span className="font-medium text-gray-800 break-all">{caseItem.requester_email}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-0.5">Macro Case:</span>
                          <span className="font-medium text-gray-800">{caseItem.macro_case || '—'}</span>
                        </div>
                        {caseItem.estimated_use_date && (
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-gray-500 block mb-0.5">Uso estimado:</span>
                            <div className="flex items-center gap-1 font-medium text-gray-800">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {formatDate(caseItem.estimated_use_date)}
                            </div>
                          </div>
                        )}
                        {tab === 'history' && caseItem.updated_at && (
                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-gray-500 block mb-0.5">Resolvido em:</span>
                            <div className="flex items-center gap-1 font-medium text-gray-800">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              {formatDate(caseItem.updated_at)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Variables Table */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-purple-500" />
                          {tab === 'history' ? 'Variáveis' : 'Variáveis Pendentes'} ({caseItem.variables?.length || 0})
                        </h4>
                        
                        {caseItem.variables && caseItem.variables.length > 0 ? (
                          <div className="border border-gray-100 rounded-xl overflow-hidden">
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left p-4 font-semibold text-gray-600">Nome</th>
                                    <th className="text-left p-4 font-semibold text-gray-600">Produto</th>
                                    <th className="text-left p-4 font-semibold text-gray-600">Conceito</th>
                                    <th className="text-left p-4 font-semibold text-gray-600">Prioridade</th>
                                    <th className="text-left p-4 font-semibold text-gray-600">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {caseItem.variables.map((variable, idx) => (
                                    <tr key={variable.id || idx} className="border-t border-gray-50 hover:bg-gray-50/50">
                                      <td className="p-4">
                                        <div className="flex items-center gap-2">
                                          <Tag className="h-4 w-4 text-purple-500" />
                                          <span className="font-medium text-gray-800">{variable.variable_name}</span>
                                        </div>
                                      </td>
                                      <td className="p-4 text-gray-500">{variable.product || '-'}</td>
                                      <td className="p-4 text-gray-500 max-w-xs truncate">{variable.concept || '-'}</td>
                                      <td className="p-4">
                                        <span className={cn(
                                          'px-2.5 py-1 text-xs rounded-full font-medium',
                                          variable.priority === 'Alta' ? 'bg-red-100 text-red-700' :
                                          variable.priority === 'Média' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        )}>
                                          {variable.priority || 'Normal'}
                                        </span>
                                      </td>
                                      <td className="p-4">
                                        {variable.is_cancelled ? (
                                          <span className="px-2.5 py-1 text-xs rounded-full font-medium bg-gray-100 text-gray-600">
                                            Cancelada
                                          </span>
                                        ) : variable.search_status === 'APPROVED' ? (
                                          <span className="px-2.5 py-1 text-xs rounded-full font-medium bg-green-100 text-green-700">
                                            Aprovada
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-1 text-xs rounded-full font-medium bg-blue-100 text-blue-700">
                                            {variable.search_status || 'Pendente'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-gray-100">
                              {caseItem.variables.map((variable, idx) => (
                                <div key={variable.id || idx} className="p-3 bg-white">
                                  {/* Top Row: Name + Priority */}
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Tag className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                      <span className="font-medium text-gray-800 text-sm truncate">{variable.variable_name}</span>
                                    </div>
                                    <span className={cn(
                                      'shrink-0 px-1.5 py-0.5 text-[10px] rounded-full font-medium',
                                      variable.priority === 'Alta' ? 'bg-red-50 text-red-600' :
                                      variable.priority === 'Média' ? 'bg-yellow-50 text-yellow-600' :
                                      'bg-gray-50 text-gray-600'
                                    )}>
                                      {variable.priority || 'Normal'}
                                    </span>
                                  </div>

                                  {/* Second Row: Product + Status */}
                                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 pl-5">
                                    {variable.product && (
                                      <>
                                        <span className="truncate max-w-[120px]">{variable.product}</span>
                                        <span className="w-0.5 h-0.5 bg-gray-300 rounded-full shrink-0" />
                                      </>
                                    )}
                                    {variable.is_cancelled ? (
                                      <span className="text-gray-500 font-medium">Cancelada</span>
                                    ) : variable.search_status === 'APPROVED' ? (
                                      <span className="text-green-600 font-medium">Aprovada</span>
                                    ) : (
                                      <span className="text-blue-600 font-medium">
                                        {variable.search_status === 'AI_SEARCHING' ? 'IA Buscando' : 'Pendente'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Concept (Simple text) */}
                                  {variable.concept && (
                                    <div className="pl-5 text-[11px] text-gray-400 italic leading-snug line-clamp-2">
                                      "{variable.concept}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">Nenhuma variável cadastrada</p>
                        )}
                      </div>

                      {caseItem.context && (
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium text-gray-800">Contexto:</span> {caseItem.context}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}


export default PendingReviews
