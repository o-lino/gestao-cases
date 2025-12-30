/**
 * Owner Response Modal
 * 
 * Modal for data owners to respond to table suggestions with structured responses.
 * Supports 5 response types with dynamic form fields and autocomplete search.
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  X, Check, AlertTriangle, Users, Building2, 
  Database, FileQuestion, Loader2, Search
} from 'lucide-react'
import { 
  matchingService,
  OwnerResponseType, 
  OwnerResponseRequest,
  CollaboratorMinimal,
  AreaMinimal,
  DataTable,
  OWNER_RESPONSE_LABELS,
  OWNER_RESPONSE_DESCRIPTIONS
} from '@/services/matchingService'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

interface OwnerResponseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  matchId: number
  variableName: string
  tableName: string
}

const RESPONSE_TYPE_ICONS: Record<OwnerResponseType, typeof Check> = {
  CONFIRM_MATCH: Check,
  CORRECT_TABLE: Database,
  DATA_NOT_EXIST: FileQuestion,
  DELEGATE_PERSON: Users,
  DELEGATE_AREA: Building2
}

const RESPONSE_TYPE_COLORS: Record<OwnerResponseType, string> = {
  CONFIRM_MATCH: 'border-green-500 bg-green-50 text-green-700',
  CORRECT_TABLE: 'border-blue-500 bg-blue-50 text-blue-700',
  DATA_NOT_EXIST: 'border-orange-500 bg-orange-50 text-orange-700',
  DELEGATE_PERSON: 'border-purple-500 bg-purple-50 text-purple-700',
  DELEGATE_AREA: 'border-teal-500 bg-teal-50 text-teal-700'
}

export function OwnerResponseModal({
  isOpen,
  onClose,
  onSuccess,
  matchId,
  variableName,
  tableName
}: OwnerResponseModalProps) {
  const toast = useToast()
  
  // State
  const [selectedType, setSelectedType] = useState<OwnerResponseType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Form fields
  const [usageCriteria, setUsageCriteria] = useState('')
  const [attentionPoints, setAttentionPoints] = useState('')
  const [notes, setNotes] = useState('')
  
  // For CORRECT_TABLE
  const [tables, setTables] = useState<DataTable[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [loadingTables, setLoadingTables] = useState(false)
  
  // For DELEGATE_PERSON
  const [collaboratorSearch, setCollaboratorSearch] = useState('')
  const [collaborators, setCollaborators] = useState<CollaboratorMinimal[]>([])
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorMinimal | null>(null)
  const [loadingCollaborators, setLoadingCollaborators] = useState(false)
  
  // For DELEGATE_AREA
  const [areaSearch, setAreaSearch] = useState('')
  const [areas, setAreas] = useState<AreaMinimal[]>([])
  const [selectedArea, setSelectedArea] = useState<AreaMinimal | null>(null)
  const [loadingAreas, setLoadingAreas] = useState(false)
  
  // Load tables when CORRECT_TABLE is selected
  useEffect(() => {
    if (selectedType === 'CORRECT_TABLE') {
      loadTables()
    }
  }, [selectedType])
  
  const loadTables = async () => {
    setLoadingTables(true)
    try {
      const result = await matchingService.listTables()
      setTables(result)
    } catch (err) {
      console.error('Error loading tables:', err)
    } finally {
      setLoadingTables(false)
    }
  }
  
  // Debounced collaborator search
  const handleCollaboratorSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCollaborators([])
      return
    }
    
    setLoadingCollaborators(true)
    try {
      const result = await matchingService.searchCollaborators(query)
      setCollaborators(result)
    } catch (err) {
      console.error('Error searching collaborators:', err)
    } finally {
      setLoadingCollaborators(false)
    }
  }, [])
  
  // Debounced area search
  const handleAreaSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setAreas([])
      return
    }
    
    setLoadingAreas(true)
    try {
      const result = await matchingService.searchAreas(query)
      setAreas(result)
    } catch (err) {
      console.error('Error searching areas:', err)
    } finally {
      setLoadingAreas(false)
    }
  }, [])
  
  // Effect for debounced searches
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedType === 'DELEGATE_PERSON' && collaboratorSearch) {
        handleCollaboratorSearch(collaboratorSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [collaboratorSearch, selectedType, handleCollaboratorSearch])
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedType === 'DELEGATE_AREA' && areaSearch) {
        handleAreaSearch(areaSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [areaSearch, selectedType, handleAreaSearch])
  
  const validateForm = (): string | null => {
    if (!selectedType) return 'Selecione um tipo de resposta'
    
    switch (selectedType) {
      case 'CONFIRM_MATCH':
        if (!usageCriteria.trim()) return 'Critérios de uso são obrigatórios'
        break
      case 'CORRECT_TABLE':
        if (!selectedTableId) return 'Selecione a tabela correta'
        break
      case 'DELEGATE_PERSON':
        if (!selectedCollaborator) return 'Selecione o colaborador responsável'
        break
      case 'DELEGATE_AREA':
        if (!selectedArea) return 'Selecione a área responsável'
        break
    }
    
    return null
  }
  
  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      const request: OwnerResponseRequest = {
        response_type: selectedType!,
        notes: notes.trim() || undefined,
      }
      
      // Add type-specific data
      switch (selectedType) {
        case 'CONFIRM_MATCH':
          request.usage_criteria = usageCriteria.trim()
          request.attention_points = attentionPoints.trim() || undefined
          break
        case 'CORRECT_TABLE':
          request.suggested_table_id = selectedTableId!
          break
        case 'DELEGATE_PERSON':
          request.delegate_to_id = selectedCollaborator!.id
          request.delegate_to_funcional = selectedCollaborator!.email
          break
        case 'DELEGATE_AREA':
          request.delegate_area_id = selectedArea!.id
          request.delegate_area_name = selectedArea!.department
          break
      }
      
      const result = await matchingService.ownerRespond(matchId, request)
      toast.success(result.message)
      onSuccess()
      onClose()
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Erro ao processar resposta'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }
  
  const resetForm = () => {
    setSelectedType(null)
    setUsageCriteria('')
    setAttentionPoints('')
    setNotes('')
    setSelectedTableId(null)
    setTableSearch('')
    setSelectedCollaborator(null)
    setCollaboratorSearch('')
    setSelectedArea(null)
    setAreaSearch('')
    setError('')
  }
  
  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  const filteredTables = tables.filter(t => 
    t.display_name.toLowerCase().includes(tableSearch.toLowerCase()) ||
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  )
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Responder Sugestão</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Variável: <strong>{variableName}</strong> → Tabela: <strong>{tableName}</strong>
              </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Response Type Selection */}
          <div className="space-y-3 mb-6">
            <label className="block text-sm font-medium">Tipo de Resposta</label>
            <div className="grid gap-2">
              {(Object.keys(OWNER_RESPONSE_LABELS) as OwnerResponseType[]).map((type) => {
                const Icon = RESPONSE_TYPE_ICONS[type]
                const isSelected = selectedType === type
                
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      isSelected 
                        ? RESPONSE_TYPE_COLORS[type] + ' border-current'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5 mt-0.5 flex-shrink-0",
                      isSelected ? '' : 'text-gray-400'
                    )} />
                    <div>
                      <div className="font-medium">{OWNER_RESPONSE_LABELS[type]}</div>
                      <div className="text-xs opacity-75">{OWNER_RESPONSE_DESCRIPTIONS[type]}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Dynamic Form Fields */}
          {selectedType && (
            <div className="space-y-4 pt-4 border-t">
              {/* CONFIRM_MATCH fields */}
              {selectedType === 'CONFIRM_MATCH' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Critérios de Uso <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={usageCriteria}
                      onChange={(e) => setUsageCriteria(e.target.value)}
                      placeholder="Descreva as regras e critérios para uso deste dado..."
                      className="w-full px-3 py-2 border rounded-lg resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Pontos de Atenção
                    </label>
                    <textarea
                      value={attentionPoints}
                      onChange={(e) => setAttentionPoints(e.target.value)}
                      placeholder="Limitações, ressalvas, cuidados ao usar este dado..."
                      className="w-full px-3 py-2 border rounded-lg resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}
              
              {/* CORRECT_TABLE fields */}
              {selectedType === 'CORRECT_TABLE' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tabela Correta <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Buscar tabela..."
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                  </div>
                  {loadingTables ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {filteredTables.map((table) => (
                        <button
                          key={table.id}
                          onClick={() => setSelectedTableId(table.id)}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0",
                            selectedTableId === table.id && 'bg-blue-50 text-blue-700'
                          )}
                        >
                          <div className="font-medium">{table.display_name}</div>
                          <div className="text-xs text-gray-500">{table.domain} • {table.name}</div>
                        </button>
                      ))}
                      {filteredTables.length === 0 && (
                        <div className="px-3 py-4 text-center text-gray-500 text-sm">
                          Nenhuma tabela encontrada
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* DELEGATE_PERSON fields */}
              {selectedType === 'DELEGATE_PERSON' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Colaborador Responsável <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={selectedCollaborator ? selectedCollaborator.name : collaboratorSearch}
                      onChange={(e) => {
                        setCollaboratorSearch(e.target.value)
                        setSelectedCollaborator(null)
                      }}
                      placeholder="Buscar por nome ou email..."
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                    {loadingCollaborators && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>
                  {collaborators.length > 0 && !selectedCollaborator && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {collaborators.map((collab) => (
                        <button
                          key={collab.id}
                          onClick={() => {
                            setSelectedCollaborator(collab)
                            setCollaborators([])
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="font-medium">{collab.name}</div>
                          <div className="text-xs text-gray-500">{collab.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCollaborator && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">{selectedCollaborator.name}</span>
                      <span className="text-xs text-purple-500">({selectedCollaborator.email})</span>
                      <button
                        onClick={() => setSelectedCollaborator(null)}
                        className="ml-auto p-1 hover:bg-purple-100 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* DELEGATE_AREA fields */}
              {selectedType === 'DELEGATE_AREA' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Área Responsável <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={selectedArea ? selectedArea.department : areaSearch}
                      onChange={(e) => {
                        setAreaSearch(e.target.value)
                        setSelectedArea(null)
                      }}
                      placeholder="Buscar área..."
                      className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    />
                    {loadingAreas && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </div>
                  {areas.length > 0 && !selectedArea && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {areas.map((area) => (
                        <button
                          key={area.id}
                          onClick={() => {
                            setSelectedArea(area)
                            setAreas([])
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="font-medium">{area.department}</div>
                          {area.cost_center && (
                            <div className="text-xs text-gray-500">CC: {area.cost_center}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedArea && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                      <Building2 className="h-4 w-4 text-teal-600" />
                      <span className="text-sm font-medium text-teal-700">{selectedArea.department}</span>
                      <button
                        onClick={() => setSelectedArea(null)}
                        className="ml-auto p-1 hover:bg-teal-100 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* DATA_NOT_EXIST note */}
              {selectedType === 'DATA_NOT_EXIST' && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-700">
                      Dados não existem
                    </p>
                    <p className="text-xs text-orange-600 mt-1">
                      O solicitante será notificado para abrir um envolvimento de criação de dados.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Common notes field */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Observações Adicionais
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais para o solicitante..."
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t flex gap-3 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedType || submitting}
            className={cn(
              "px-4 py-2 rounded-lg text-white transition-colors flex items-center gap-2",
              selectedType 
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            )}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar Resposta
          </button>
        </div>
      </div>
    </div>
  )
}

export default OwnerResponseModal
