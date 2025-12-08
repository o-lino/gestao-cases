import { useState, useEffect, useCallback } from 'react'
import { caseService, Case } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { Plus, Filter, Search, LayoutGrid, List, Download, ChevronDown } from 'lucide-react'
import { KanbanBoard } from '@/components/cases/KanbanBoard'
import { exportCasesToCSV, exportCasesToJSON } from '@/utils/export'
import { useToast } from '@/components/common/Toast'

type ViewMode = 'list' | 'kanban'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviado',
  REVIEW: 'Em Revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CLOSED: 'Fechado',
}

export function CasesPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('casesViewMode') as ViewMode) || 'list'
  })
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  })
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => {
    loadCases()
  }, [filters.status])

  useEffect(() => {
    localStorage.setItem('casesViewMode', viewMode)
  }, [viewMode])

  const loadCases = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiFilters: any = {}
      if (filters.status) apiFilters.status = filters.status
      
      const data = await caseService.getAll(apiFilters)
      setCases(Array.isArray(data) ? data : [])
    } catch (error: any) {
      console.error('Failed to load cases', error)
      setError('Erro ao carregar cases.')
    } finally {
      setLoading(false)
    }
  }

  const filteredCases = cases.filter(c => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        c.title.toLowerCase().includes(searchLower) ||
        c.client_name?.toLowerCase().includes(searchLower) ||
        c.macro_case?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      exportCasesToCSV(filteredCases)
      toast.success('Exportado para CSV')
    } else {
      exportCasesToJSON(filteredCases)
      toast.success('Exportado para JSON')
    }
    setShowExportMenu(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cases</h1>
          <p className="text-muted-foreground">{filteredCases.length} case(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Exportar
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1 w-32 bg-card border rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    JSON
                  </button>
                </div>
              </>
            )}
          </div>
          
          <Link
            to="/cases/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Novo Case
          </Link>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border">
        <div className="flex-1 flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
            />
          </div>
          
          {/* Status Filter */}
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Todos os Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center border rounded-lg p-1 bg-muted/50">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-card shadow-sm' : 'hover:bg-card/50'
            }`}
            title="Visualização em Lista"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'kanban' ? 'bg-card shadow-sm' : 'hover:bg-card/50'
            }`}
            title="Visualização Kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="p-8 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={loadCases} className="mt-2 text-sm text-primary hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard cases={filteredCases} />
      ) : (
        // Table View (simplified - full implementation is in CaseList.tsx)
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Título</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Data</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.client_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      c.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      c.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      c.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/cases/${c.id}`} className="text-primary hover:underline text-sm">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
