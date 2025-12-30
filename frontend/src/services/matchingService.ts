/**
 * Matching Service
 * 
 * Handles data matching workflow:
 * - Search for variable matches
 * - Select and approve matches
 * - Get case progress
 * - Owner structured responses
 */

import api from './api'

// ============== Types ==============

export type MatchStatus = 'SUGGESTED' | 'SELECTED' | 'PENDING_OWNER' | 'PENDING_REQUESTER' | 'APPROVED' | 'REJECTED' | 'REJECTED_BY_REQUESTER' | 'REDIRECTED' | 'PENDING_VALIDATION'
export type VariableSearchStatus = 'PENDING' | 'SEARCHING' | 'MATCHED' | 'NO_MATCH' | 'OWNER_REVIEW' | 'REQUESTER_REVIEW' | 'APPROVED' | 'IN_USE' | 'CANCELLED' | 'PENDING_INVOLVEMENT'

// Owner Response Types
export type OwnerResponseType = 'CORRECT_TABLE' | 'DATA_NOT_EXIST' | 'DELEGATE_PERSON' | 'DELEGATE_AREA' | 'CONFIRM_MATCH'

// Requester Response Types
export type RequesterResponseType = 'APPROVE' | 'REJECT_WRONG_DATA' | 'REJECT_INCOMPLETE' | 'REJECT_WRONG_GRANULARITY' | 'REJECT_WRONG_PERIOD' | 'REJECT_OTHER'


export interface VariableMatch {
  id: number
  case_variable_id: number
  data_table_id: number
  table_name?: string
  table_display_name?: string
  table_description?: string
  score: number
  match_reason?: string
  status: MatchStatus
  is_selected: boolean
  matched_column?: string
}

export interface VariableProgress {
  id: number
  variable_name: string
  variable_type: string
  search_status: VariableSearchStatus
  match_count: number
  top_score?: number
  selected_table?: string
}

export interface CaseProgress {
  total: number
  pending: number
  searching: number
  matched: number
  owner_review: number
  approved: number
  no_match: number
  progress_percent: number
  variables: VariableProgress[]
}

export interface DataTable {
  id: number
  name: string
  display_name: string
  description?: string
  domain?: string
  owner_id?: number
  owner_name?: string
  is_active: boolean
}

export interface DataTableCreate {
  name: string
  display_name: string
  description?: string
  schema_name?: string
  database_name?: string
  domain?: string
  keywords?: string[]
  owner_id?: number
}

// Owner Response Types
export interface OwnerResponseRequest {
  response_type: OwnerResponseType
  suggested_table_id?: number
  delegate_to_funcional?: string
  delegate_to_id?: number
  delegate_area_id?: number
  delegate_area_name?: string
  usage_criteria?: string
  attention_points?: string
  notes?: string
}

export interface OwnerResponseResult {
  match_id: number
  response_id: number
  response_type: string
  is_validated: boolean
  validation_result?: string
  match_status: string
  variable_status: string
  message: string
}

export interface CollaboratorMinimal {
  id: number
  name: string
  email: string
}

export interface AreaMinimal {
  id: number
  department: string
  cost_center?: string
}

// Requester Response Types
export interface RequesterResponseRequest {
  response_type: RequesterResponseType
  rejection_reason?: string
  expected_data_description?: string
  improvement_suggestions?: string
}

export interface RequesterResponseResult {
  match_id: number
  response_id: number
  response_type: string
  is_validated: boolean
  match_status: string
  variable_status: string
  loop_count: number
  message: string
}

// ============== Status Labels ==============


export const SEARCH_STATUS_LABELS: Record<VariableSearchStatus, string> = {
  PENDING: 'Pendente',
  SEARCHING: 'Buscando...',
  MATCHED: 'Matches Encontrados',
  NO_MATCH: 'Sem Match',
  OWNER_REVIEW: 'Aguardando Owner',
  REQUESTER_REVIEW: 'Confirme Indicação',
  APPROVED: 'Aprovada',
  IN_USE: 'Em Uso',
  CANCELLED: 'Cancelada',
  PENDING_INVOLVEMENT: 'Aguardando Envolvimento'
}

export const SEARCH_STATUS_COLORS: Record<VariableSearchStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  SEARCHING: 'bg-blue-100 text-blue-700',
  MATCHED: 'bg-yellow-100 text-yellow-700',
  NO_MATCH: 'bg-red-100 text-red-700',
  OWNER_REVIEW: 'bg-purple-100 text-purple-700',
  REQUESTER_REVIEW: 'bg-cyan-100 text-cyan-700',
  APPROVED: 'bg-green-100 text-green-700',
  IN_USE: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
  PENDING_INVOLVEMENT: 'bg-orange-100 text-orange-700'
}

export const OWNER_RESPONSE_LABELS: Record<OwnerResponseType, string> = {
  CORRECT_TABLE: 'Tabela Correta é Outra',
  DATA_NOT_EXIST: 'Dados Não Existem',
  DELEGATE_PERSON: 'Outra Pessoa da Área',
  DELEGATE_AREA: 'Outra Área Responsável',
  CONFIRM_MATCH: 'Indicação Perfeita'
}

export const OWNER_RESPONSE_DESCRIPTIONS: Record<OwnerResponseType, string> = {
  CORRECT_TABLE: 'Sou o responsável pelo conceito, mas a tabela correta é outra',
  DATA_NOT_EXIST: 'Sou o responsável, mas os dados não existem (necessário envolvimento)',
  DELEGATE_PERSON: 'Não sou o responsável, mas outra pessoa da minha área é',
  DELEGATE_AREA: 'Minha área não é responsável, outra área é',
  CONFIRM_MATCH: 'Esta é a indicação perfeita para este conceito'
}

export const REQUESTER_RESPONSE_LABELS: Record<RequesterResponseType, string> = {
  APPROVE: 'Confirmar Indicação',
  REJECT_WRONG_DATA: 'Dados Incorretos',
  REJECT_INCOMPLETE: 'Dados Incompletos',
  REJECT_WRONG_GRANULARITY: 'Granularidade Errada',
  REJECT_WRONG_PERIOD: 'Período Incorreto',
  REJECT_OTHER: 'Outro Motivo'
}

export const REQUESTER_RESPONSE_DESCRIPTIONS: Record<RequesterResponseType, string> = {
  APPROVE: 'Os dados atendem perfeitamente à minha necessidade',
  REJECT_WRONG_DATA: 'Os dados não correspondem ao que foi solicitado',
  REJECT_INCOMPLETE: 'Faltam campos ou colunas necessários',
  REJECT_WRONG_GRANULARITY: 'O nível de detalhe está incorreto',
  REJECT_WRONG_PERIOD: 'O período ou frequência não atende',
  REJECT_OTHER: 'Outro motivo (explique abaixo)'
}

// ============== Pending Owner Action ==============

export interface PendingOwnerAction {
  match_id: number
  variable_id: number | null
  variable_name: string | null
  product: string | null
  concept: string | null
  priority: string | null
  case_id: number | null
  case_title: string | null
  case_client: string | null
  requester_email: string | null
  table_id: number | null
  table_name: string | null
  table_display_name: string | null
  match_score: number
  created_at: string | null
}

// ============== Service ==============


export const matchingService = {
  // Pending owner actions
  getPendingOwnerActions: async (): Promise<PendingOwnerAction[]> => {
    const response = await api.get('/matching/pending-owner-actions')
    return response.data
  },
  
  // Variable search
  searchMatches: async (variableId: number): Promise<VariableMatch[]> => {
    const response = await api.post(`/matching/variables/${variableId}/search`)
    return response.data
  },

  
  getVariableMatches: async (variableId: number): Promise<VariableMatch[]> => {
    const response = await api.get(`/matching/variables/${variableId}/matches`)
    return response.data
  },
  
  selectMatch: async (variableId: number, matchId: number): Promise<VariableMatch> => {
    const response = await api.post(`/matching/variables/${variableId}/select`, {
      match_id: matchId
    })
    return response.data
  },
  
  // Owner actions
  approveMatch: async (matchId: number): Promise<VariableMatch> => {
    const response = await api.post(`/matching/matches/${matchId}/approve`)
    return response.data
  },
  
  rejectMatch: async (matchId: number, reason?: string): Promise<VariableMatch> => {
    const response = await api.post(`/matching/matches/${matchId}/reject`, {
      reason
    })
    return response.data
  },
  
  // Structured owner response
  ownerRespond: async (matchId: number, data: OwnerResponseRequest): Promise<OwnerResponseResult> => {
    const response = await api.post(`/matching/matches/${matchId}/respond`, data)
    return response.data
  },
  
  // Structured requester response
  requesterRespond: async (matchId: number, data: RequesterResponseRequest): Promise<RequesterResponseResult> => {
    const response = await api.post(`/matching/matches/${matchId}/requester-respond`, data)
    return response.data
  },
  
  // Autocomplete search
  searchCollaborators: async (query: string, limit: number = 10): Promise<CollaboratorMinimal[]> => {
    const response = await api.get('/matching/search/collaborators', {
      params: { q: query, limit }
    })
    return response.data
  },
  
  searchAreas: async (query: string, limit: number = 10): Promise<AreaMinimal[]> => {
    const response = await api.get('/matching/search/areas', {
      params: { q: query, limit }
    })
    return response.data
  },
  
  // Mark variable as "in use"
  markVariableInUse: async (variableId: number): Promise<{ variable_id: number; search_status: string; message: string }> => {
    const response = await api.post(`/matching/variables/${variableId}/mark-in-use`)
    return response.data
  },
  
  // Case progress
  getCaseProgress: async (caseId: number): Promise<CaseProgress> => {
    const response = await api.get(`/matching/cases/${caseId}/progress`)
    return response.data
  },
  
  // Catalog
  listTables: async (domain?: string): Promise<DataTable[]> => {
    const params = domain ? { domain } : {}
    const response = await api.get('/matching/catalog/tables', { params })
    return response.data
  },
  
  getDataTables: async (domain?: string): Promise<DataTable[]> => {
    const params = domain ? { domain } : {}
    const response = await api.get('/matching/catalog/tables', { params })
    return response.data
  },
  
  createDataTable: async (data: DataTableCreate): Promise<DataTable> => {
    const response = await api.post('/matching/catalog/tables', data)
    return response.data
  },
  
  getDataTable: async (tableId: number): Promise<DataTable> => {
    const response = await api.get(`/matching/catalog/tables/${tableId}`)
    return response.data
  }
}

export default matchingService
