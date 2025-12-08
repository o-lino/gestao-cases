/**
 * Matching Service
 * 
 * Handles data matching workflow:
 * - Search for variable matches
 * - Select and approve matches
 * - Get case progress
 */

import api from './api'

// ============== Types ==============

export type MatchStatus = 'SUGGESTED' | 'SELECTED' | 'PENDING_OWNER' | 'APPROVED' | 'REJECTED'
export type VariableSearchStatus = 'PENDING' | 'SEARCHING' | 'MATCHED' | 'NO_MATCH' | 'OWNER_REVIEW' | 'APPROVED'

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

// ============== Status Labels ==============

export const SEARCH_STATUS_LABELS: Record<VariableSearchStatus, string> = {
  PENDING: 'Pendente',
  SEARCHING: 'Buscando...',
  MATCHED: 'Matches Encontrados',
  NO_MATCH: 'Sem Match',
  OWNER_REVIEW: 'Aguardando Owner',
  APPROVED: 'Aprovada'
}

export const SEARCH_STATUS_COLORS: Record<VariableSearchStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  SEARCHING: 'bg-blue-100 text-blue-700',
  MATCHED: 'bg-yellow-100 text-yellow-700',
  NO_MATCH: 'bg-red-100 text-red-700',
  OWNER_REVIEW: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700'
}

// ============== Service ==============

export const matchingService = {
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
  
  // Case progress
  getCaseProgress: async (caseId: number): Promise<CaseProgress> => {
    const response = await api.get(`/matching/cases/${caseId}/progress`)
    return response.data
  },
  
  // Catalog
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
