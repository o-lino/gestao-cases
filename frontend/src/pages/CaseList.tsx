import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Filter, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trash2, CheckSquare, Square, Loader2, FolderOpen, ArrowUpRight } from 'lucide-react'
import { caseService, Case } from '@/services/caseService'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/common/Toast'

type SortField = 'title' | 'client_name' | 'status' | 'created_at' | 'budget'
type SortDirection = 'asc' | 'desc'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviado',
  REVIEW: 'Em Revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  CLOSED: 'Fechado',
}

export function CaseList() {
  const { user } = useAuth()
  const toast = useToast()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [filters, setFilters] = useState({
    status: '',
    created_by: '',
    search: '',
  })
  
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadCases()
  }, [filters.status, filters.created_by])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.search])

  const loadCases = async () => {
    try {
      setLoading(true)
      setError(null)
      const apiFilters: any = {}
      if (filters.status) apiFilters.status = filters.status
      if (filters.created_by === 'me' && user) apiFilters.created_by = user.id
      
      const data = await caseService.getAll(apiFilters)
      
      if (Array.isArray(data)) {
        setCases(data)
      } else {
        setCases([])
        setError('Formato de resposta inválido.')
      }
    } catch (error: any) {
      setError('Erro ao carregar cases.')
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    let filtered = [...cases]
    
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.client_name?.toLowerCase().includes(searchLower) ||
        c.macro_case?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
      )
    }
    
    filtered.sort((a, b) => {
      let comparison = 0
      const aVal = a[sortField]
      const bVal = b[sortField]
      
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      
      if (sortField === 'created_at') {
        comparison = new Date(aVal as string).getTime() - new Date(bVal as string).getTime()
      } else if (sortField === 'budget') {
        comparison = (aVal as number || 0) - (bVal as number || 0)
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return filtered
  }, [cases, filters.search, sortField, sortDirection])

  const totalPages = Math.ceil(processedData.length / itemsPerPage)
  const paginatedData = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedData.map(c => c.id)))
    }
  }

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} case(s)?`)) return
    
    try {
      // Call delete API for each selected case
      await caseService.deleteBulk(Array.from(selectedIds))
      toast.success(`${selectedIds.size} case(s) excluído(s) com sucesso`)
      setSelectedIds(new Set())
      loadCases() // Reload the list after deletion
    } catch (error: any) {
      console.error('Delete error:', error)
      if (error?.response?.status === 403) {
        toast.error('Você não tem permissão para excluir um ou mais cases selecionados')
      } else {
        toast.error('Erro ao excluir cases')
      }
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700'
      case 'REJECTED': return 'bg-red-100 text-red-700'
      case 'DRAFT': return 'bg-yellow-100 text-yellow-700'
      case 'REVIEW': return 'bg-purple-100 text-purple-700'
      case 'CLOSED': return 'bg-gray-100 text-gray-700'
      default: return 'bg-blue-100 text-blue-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-gray-500">Carregando cases...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={loadCases} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl text-white">
              <FolderOpen className="h-6 w-6" />
            </div>
            Cases
          </h1>
          <p className="text-gray-500 mt-1">{processedData.length} case(s) encontrado(s)</p>
        </div>
        <Link
          to="/cases/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 h-11 px-6 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 transition-all transform hover:scale-[1.02]"
        >
          <Plus className="h-5 w-5" />
          Novo Case
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título, cliente, macro case..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            className="h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">Todos os Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="h-12 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            value={filters.created_by}
            onChange={(e) => setFilters(prev => ({ ...prev, created_by: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="me">Meus Cases</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-200">
          <span className="text-sm font-semibold text-orange-800">{selectedIds.size} selecionado(s)</span>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="w-12 p-4">
                  <button onClick={handleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {selectedIds.size === paginatedData.length && paginatedData.length > 0 
                      ? <CheckSquare className="h-5 w-5 text-orange-500" /> 
                      : <Square className="h-5 w-5" />
                    }
                  </button>
                </th>
                <th 
                  className="p-4 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    Título <SortIcon field="title" />
                  </div>
                </th>
                <th 
                  className="p-4 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                  onClick={() => handleSort('client_name')}
                >
                  <div className="flex items-center gap-2">
                    Cliente <SortIcon field="client_name" />
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-600">Macro Case</th>
                <th 
                  className="p-4 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status <SortIcon field="status" />
                  </div>
                </th>
                <th 
                  className="p-4 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                  onClick={() => handleSort('budget')}
                >
                  <div className="flex items-center gap-2">
                    Budget <SortIcon field="budget" />
                  </div>
                </th>
                <th 
                  className="p-4 text-left font-semibold text-gray-600 cursor-pointer hover:text-gray-900 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-2">
                    Criado em <SortIcon field="created_at" />
                  </div>
                </th>
                <th className="p-4 text-left font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Nenhum case encontrado.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((c) => (
                  <tr 
                    key={c.id} 
                    className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${selectedIds.has(c.id) ? 'bg-orange-50/50' : ''}`}
                  >
                    <td className="p-4">
                      <button onClick={() => handleSelectOne(c.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedIds.has(c.id) 
                          ? <CheckSquare className="h-5 w-5 text-orange-500" /> 
                          : <Square className="h-5 w-5" />
                        }
                      </button>
                    </td>
                    <td className="p-4">
                      <Link to={`/cases/${c.id}`} className="font-medium text-gray-800 hover:text-orange-600 transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-500">{c.client_name || '-'}</td>
                    <td className="p-4 text-gray-500">{c.macro_case || '-'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(c.status)}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">
                      {c.budget 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(c.budget)
                        : '-'
                      }
                    </td>
                    <td className="p-4 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <Link 
                        to={`/cases/${c.id}`} 
                        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
                      >
                        Ver <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Itens por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
