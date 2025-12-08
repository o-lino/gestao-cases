import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Clock, FileText, Check, ChevronDown, ChevronUp, 
  Inbox, Send, Eye, Tag, Calendar, Loader2, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { caseService, Case, CaseVariable } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'

type Tab = 'owner' | 'requester'

export function PendingReviews() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('owner')
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    loadCases()
  }, [])

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

  const myCasesInReview = cases.filter(c => 
    c.requester_email === user?.email && 
    ['REVIEW', 'SUBMITTED'].includes(c.status)
  )

  const casesToReview = cases.filter(c => 
    c.status === 'SUBMITTED' && 
    c.requester_email !== user?.email
  )

  const totalVariablesPending = (tab === 'owner' ? casesToReview : myCasesInReview)
    .reduce((sum, c) => sum + (c.variables?.length || 0), 0)

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'SUBMITTED': 'bg-blue-100 text-blue-700',
      'REVIEW': 'bg-purple-100 text-purple-700',
      'APPROVED': 'bg-green-100 text-green-700',
      'REJECTED': 'bg-red-100 text-red-700',
      'DRAFT': 'bg-yellow-100 text-yellow-700',
      'CLOSED': 'bg-gray-100 text-gray-700',
    }
    const labels: Record<string, string> = {
      'SUBMITTED': 'Enviado',
      'REVIEW': 'Em Revisão',
      'APPROVED': 'Aprovado',
      'REJECTED': 'Rejeitado',
      'DRAFT': 'Rascunho',
      'CLOSED': 'Fechado',
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

  const casesToShow = tab === 'owner' ? casesToReview : myCasesInReview

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl text-white shadow-lg shadow-orange-500/30">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Pendências</h1>
          <p className="text-gray-500">Gerencie cases e variáveis aguardando sua ação</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Inbox className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{casesToReview.length}</p>
          <p className="text-sm text-gray-500">Para Aprovar</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Send className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{myCasesInReview.length}</p>
          <p className="text-sm text-gray-500">Minhas em Revisão</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{totalVariablesPending}</p>
          <p className="text-sm text-gray-500">Variáveis Pendentes</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{cases.filter(c => c.status === 'APPROVED').length}</p>
          <p className="text-sm text-gray-500">Aprovados</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('owner')}
            className={cn(
              "flex items-center gap-2 px-6 py-4 font-medium transition-all relative",
              tab === 'owner' 
                ? "text-orange-600" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Inbox className="h-5 w-5" />
            Para Minha Aprovação
            {casesToReview.length > 0 && (
              <span className={cn(
                "ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full",
                tab === 'owner' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
              )}>
                {casesToReview.length}
              </span>
            )}
            {tab === 'owner' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
            )}
          </button>
          <button
            onClick={() => setTab('requester')}
            className={cn(
              "flex items-center gap-2 px-6 py-4 font-medium transition-all relative",
              tab === 'requester' 
                ? "text-orange-600" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Send className="h-5 w-5" />
            Minhas Solicitações
            {myCasesInReview.length > 0 && (
              <span className={cn(
                "ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full",
                tab === 'requester' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
              )}>
                {myCasesInReview.length}
              </span>
            )}
            {tab === 'requester' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-3" />
              <p className="text-sm text-gray-500">Carregando pendências...</p>
            </div>
          ) : casesToShow.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Tudo em dia!</h2>
              <p className="text-gray-500">
                {tab === 'owner' 
                  ? 'Não há cases aguardando sua aprovação.' 
                  : 'Suas solicitações não estão pendentes de revisão.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {casesToShow.map(caseItem => (
                <div
                  key={caseItem.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card Header */}
                  <div
                    className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white transition-colors"
                    onClick={() => setExpandedId(expandedId === caseItem.id ? null : caseItem.id)}
                  >
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
                      Analisar
                    </Link>

                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                      {expandedId === caseItem.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === caseItem.id && (
                    <div className="border-t border-gray-100 bg-white p-5">
                      <div className="flex flex-wrap gap-6 mb-5 text-sm">
                        <div>
                          <span className="text-gray-500">Solicitante:</span>
                          <span className="ml-2 font-medium text-gray-800">{caseItem.requester_email}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Macro Case:</span>
                          <span className="ml-2 font-medium text-gray-800">{caseItem.macro_case || 'Não definido'}</span>
                        </div>
                        {caseItem.estimated_use_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-500">Uso estimado:</span>
                            <span className="ml-1 font-medium text-gray-800">{formatDate(caseItem.estimated_use_date)}</span>
                          </div>
                        )}
                      </div>

                      {/* Variables Table */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-purple-500" />
                          Variáveis Pendentes ({caseItem.variables?.length || 0})
                        </h4>
                        
                        {caseItem.variables && caseItem.variables.length > 0 ? (
                          <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="text-left p-4 font-semibold text-gray-600">Nome</th>
                                  <th className="text-left p-4 font-semibold text-gray-600">Produto</th>
                                  <th className="text-left p-4 font-semibold text-gray-600">Conceito</th>
                                  <th className="text-left p-4 font-semibold text-gray-600">Prioridade</th>
                                  <th className="text-left p-4 font-semibold text-gray-600">Tipo</th>
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
                                    <td className="p-4 text-gray-500">{variable.variable_type || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
    </div>
  )
}

export default PendingReviews
