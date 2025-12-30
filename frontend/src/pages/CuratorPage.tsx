/**
 * Curator Page
 * Page for curators to review and correct table suggestions
 */

import { useState, useEffect } from 'react'
import { 
  Database, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Edit3,
  History,
  BarChart3,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  Filter,
  X
} from 'lucide-react'
import { PageLayout, PageTab } from '../components/common/PageLayout'
import { useAuth } from '../context/AuthContext'
import curatorService, { 
  VariableForReview, 
  Correction, 
  CuratorStats 
} from '../services/curatorService'
import matchingService from '../services/matchingService'
import { useToast } from '../components/common/Toast'
import { cn } from '../lib/utils'

type TabType = 'review' | 'history' | 'stats'

export function CuratorPage() {
  const { canCurate } = useAuth()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<TabType>('review')
  const [loading, setLoading] = useState(true)
  const [variables, setVariables] = useState<VariableForReview[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [stats, setStats] = useState<CuratorStats | null>(null)
  
  // Modal state
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [selectedVariable, setSelectedVariable] = useState<VariableForReview | null>(null)
  const [availableTables, setAvailableTables] = useState<any[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Check access
  if (!canCurate()) {
    return (
      <div className="p-8 text-center">
        <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página.
          <br />Apenas Curadores, Moderadores e Administradores podem corrigir sugestões de tabelas.
        </p>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'review') {
        const data = await curatorService.listVariablesForReview()
        setVariables(data)
      } else if (activeTab === 'history') {
        const data = await curatorService.getCorrectionHistory({ my_corrections: true })
        setCorrections(data)
      } else if (activeTab === 'stats') {
        const data = await curatorService.getStats()
        setStats(data)
      }
    } catch (error) {
      console.error('Error loading curator data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (id: string) => {
    setVariables(prev => prev.filter(s => s.id !== id))
  }

  const handleReject = (id: string) => {
    setVariables(prev => prev.filter(s => s.id !== id))
    setSelectedVariable(variables.find(v => v.id === id) || null)
    setShowCorrectionModal(true)
  }

  const handleCorrection = async () => {
    if (!selectedVariable || !selectedTableId) return
    
    setSubmitting(true)
    try {
      await curatorService.correctVariable(selectedVariable.id, {
        correct_table_id: selectedTableId,
        correction_reason: correctionReason
      })
      
      toast.success('Correção aplicada com sucesso')
      setVariables(prev => prev.filter(v => v.id !== selectedVariable.id))
      setShowCorrectionModal(false)
      setSelectedVariable(null)
      setSelectedTableId(null)
      setCorrectionReason('')
    } catch (error) {
      console.error('Error applying correction:', error)
      toast.error('Erro ao aplicar correção')
    } finally {
      setSubmitting(false)
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600'
    if (score >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const tabs: PageTab[] = [
    { id: 'review', label: 'Revisão Pendente', icon: Filter, badge: variables.length },
    { id: 'history', label: 'Histórico de Correções', icon: Clock },
    { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  ]

  return (
    <PageLayout
      title="Curadoria de Sugestões"
      subtitle="Revise e corrija as sugestões de tabelas do sistema de matching"
      icon={Database}
      iconColor="bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabType)}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : activeTab === 'review' ? (
          <div className="space-y-4">
            {variables.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tudo em dia!</h3>
                <p className="text-muted-foreground">Não há sugestões pendentes para revisão no momento.</p>
              </div>
            ) : (
              variables.map(suggestion => (
                <div key={suggestion.id} className="p-4 border border-gray-100 rounded-xl hover:shadow-md transition-all bg-white">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Variável:</span>
                        <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                          {suggestion.variable}
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Sugestão:</span>
                        <code className="text-sm font-mono bg-purple-50 px-2 py-0.5 rounded text-purple-700 font-bold">
                          {suggestion.suggestedTable}
                        </code>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleReject(suggestion.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Rejeitar"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleApprove(suggestion.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Aprovar"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Confiança Global:</span>
                      <span className={`font-bold ${scoreColor(suggestion.confidence)}`}>
                        {(suggestion.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Colunas: <span className="font-medium text-gray-700">{(suggestion.matchDetails.columnMatch * 100).toFixed(0)}%</span></span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"/>
                      <span>Nome: <span className="font-medium text-gray-700">{(suggestion.matchDetails.nameMatch * 100).toFixed(0)}%</span></span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"/>
                      <span>Semântica: <span className="font-medium text-gray-700">{(suggestion.matchDetails.semanticMatch * 100).toFixed(0)}%</span></span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-4">
            {corrections.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma correção ainda</h3>
                <p className="text-muted-foreground">
                  Você ainda não fez nenhuma correção de sugestão.
                </p>
              </div>
            ) : (
              corrections.map(correction => (
                <div 
                  key={correction.id}
                  className="bg-card border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Variável #{correction.variable_id}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Tabela #{correction.corrected_table_id}
                        </span>
                      </div>
                      {correction.correction_reason && (
                        <p className="text-sm text-muted-foreground">
                          {correction.correction_reason}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(correction.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'stats' && stats ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Edit3 className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground">Total de Correções</span>
              </div>
              <p className="text-3xl font-bold">{stats.total_corrections}</p>
            </div>
            
            <div className="bg-card border rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Clock className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground">Este Mês</span>
              </div>
              <p className="text-3xl font-bold">{stats.corrections_this_month}</p>
            </div>
            
            <div className="bg-card border rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground">Corrigidas após Aprovação</span>
              </div>
              <p className="text-3xl font-bold">{stats.corrected_approved}</p>
            </div>
            
            <div className="bg-card border rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-sm text-muted-foreground">Corrigidas antes de Aprovar</span>
              </div>
              <p className="text-3xl font-bold">{stats.corrected_before_approval}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Correction Modal */}
      {showCorrectionModal && selectedVariable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Corrigir Sugestão de Tabela</h2>
              <p className="text-muted-foreground">
                Variável: <span className="font-medium">{selectedVariable.variable_name}</span>
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Current table */}
              {selectedVariable.selected_table && (
                <div>
                  <label className="block text-sm font-medium mb-2">Tabela Atual (Incorreta)</label>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span>{selectedVariable.selected_table.display_name || selectedVariable.selected_table.name}</span>
                  </div>
                </div>
              )}
              
              {/* Select correct table */}
              <div>
                <label className="block text-sm font-medium mb-2">Selecione a Tabela Correta</label>
                <select
                  value={selectedTableId || ''}
                  onChange={(e) => setSelectedTableId(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione uma tabela...</option>
                  {availableTables.map(table => (
                    <option key={table.id} value={table.id}>
                      {table.display_name || table.name} ({table.domain || 'Sem domínio'})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium mb-2">Justificativa (opcional)</label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="Explique por que esta tabela é mais adequada..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCorrection}
                disabled={!selectedTableId || submitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Aplicando...' : 'Aplicar Correção'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

export default CuratorPage
