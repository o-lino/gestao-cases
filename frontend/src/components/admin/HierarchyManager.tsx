import { useState, useEffect } from 'react'
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2,
  ChevronRight,
  Building2,
  User,
  ArrowUpRight
} from 'lucide-react'
import hierarchyService, { 
  HierarchyEntry, 
  HierarchyCreate,
  JobLevelLabels,
  JobLevel
} from '@/services/hierarchyService'
import { useToast } from '@/components/common/Toast'

interface HierarchyManagerProps {
  onClose?: () => void
}

export function HierarchyManager({ onClose }: HierarchyManagerProps) {
  const toast = useToast()
  const [entries, setEntries] = useState<HierarchyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<HierarchyEntry | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<{
    collaboratorId: string
    supervisorId: string
    jobLevel: JobLevel
    jobTitle: string
    department: string
  }>({
    collaboratorId: '',
    supervisorId: '',
    jobLevel: 1,
    jobTitle: '',
    department: ''
  })

  useEffect(() => {
    loadEntries()
  }, [departmentFilter])

  const loadEntries = async () => {
    try {
      setLoading(true)
      const response = await hierarchyService.list({
        department: departmentFilter || undefined,
        limit: 500
      })
      setEntries(response.items)
    } catch (error) {
      toast.error('Erro ao carregar hierarquia')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingEntry) {
        await hierarchyService.update(editingEntry.collaboratorId, {
          supervisorId: formData.supervisorId ? parseInt(formData.supervisorId) : null,
          jobLevel: formData.jobLevel,
          jobTitle: formData.jobTitle,
          department: formData.department
        })
        toast.success('Hierarquia atualizada!')
      } else {
        await hierarchyService.create({
          collaboratorId: parseInt(formData.collaboratorId),
          supervisorId: formData.supervisorId ? parseInt(formData.supervisorId) : null,
          jobLevel: formData.jobLevel,
          jobTitle: formData.jobTitle,
          department: formData.department
        })
        toast.success('Entrada criada!')
      }
      
      setShowForm(false)
      setEditingEntry(null)
      resetForm()
      loadEntries()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar')
    }
  }

  const handleEdit = (entry: HierarchyEntry) => {
    setEditingEntry(entry)
    setFormData({
      collaboratorId: String(entry.collaboratorId),
      supervisorId: entry.supervisorId ? String(entry.supervisorId) : '',
      jobLevel: entry.jobLevel,
      jobTitle: entry.jobTitle || '',
      department: entry.department || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (entry: HierarchyEntry) => {
    if (!confirm(`Desativar hierarquia de ${entry.collaborator?.name}?`)) return
    
    try {
      await hierarchyService.delete(entry.collaboratorId)
      toast.success('Hierarquia desativada')
      loadEntries()
    } catch (error) {
      toast.error('Erro ao desativar')
    }
  }

  const resetForm = () => {
    setFormData({
      collaboratorId: '',
      supervisorId: '',
      jobLevel: 1,
      jobTitle: '',
      department: ''
    })
  }

  const filteredEntries = entries.filter(e => {
    const search = searchTerm.toLowerCase()
    return (
      e.collaborator?.name?.toLowerCase().includes(search) ||
      e.collaborator?.email?.toLowerCase().includes(search) ||
      e.department?.toLowerCase().includes(search)
    )
  })

  const departments = [...new Set(entries.map(e => e.department).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Users className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Hierarquia Organizacional</h2>
            <p className="text-sm text-muted-foreground">{entries.length} registros</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingEntry(null); resetForm() }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
        >
          <option value="">Todos os departamentos</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md border border-gray-100 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingEntry ? 'Editar Hierarquia' : 'Nova Entrada'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEntry && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ID do Colaborador</label>
                  <input
                    type="number"
                    value={formData.collaboratorId}
                    onChange={(e) => setFormData({...formData, collaboratorId: e.target.value})}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">ID do Supervisor</label>
                <input
                  type="number"
                  value={formData.supervisorId}
                  onChange={(e) => setFormData({...formData, supervisorId: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Deixe vazio se não houver"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nível do Cargo</label>
                <select
                  value={formData.jobLevel}
                  onChange={(e) => setFormData({...formData, jobLevel: parseInt(e.target.value) as JobLevel})}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Object.entries(JobLevelLabels).map(([level, label]) => (
                    <option key={level} value={level}>{level}. {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Título do Cargo</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Departamento</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingEntry(null) }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum registro encontrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Colaborador</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Cargo</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Departamento</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Supervisor</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium text-sm">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-gray-900 font-medium">{entry.collaborator?.name}</div>
                        <div className="text-sm text-gray-500">{entry.collaborator?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.jobLevel >= 6 ? 'bg-purple-100 text-purple-700' :
                        entry.jobLevel >= 4 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {entry.jobLevelLabel}
                      </span>
                      {entry.jobTitle && (
                        <span className="text-gray-400 text-sm">{entry.jobTitle}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {entry.department || '-'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {entry.supervisor ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <ArrowUpRight className="w-4 h-4 text-gray-400" />
                        {entry.supervisor.name}
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
                        className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
