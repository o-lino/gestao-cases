/**
 * Curator Service
 * API client for curator operations
 */

import api from './api'

export interface VariableForReview {
  id: number
  variable_name: string
  variable_type: string
  concept: string | null
  case_id: number
  search_status: string
  match_count: number
  selected_table: {
    id: number
    name: string
    display_name: string
    score: number
    status: string
  } | null
  other_matches: Array<{
    id: number
    name: string
    display_name: string
    score: number
  }>
}

export interface CorrectionRequest {
  new_table_id: number
  reason?: string
}

export interface Correction {
  id: number
  variable_id: number
  original_table_id: number | null
  corrected_table_id: number
  curator_id: number
  correction_reason: string | null
  created_at: string
}

export interface CuratorStats {
  total_corrections: number
  corrections_this_month: number
  corrected_approved: number
  corrected_before_approval: number
}

const curatorService = {
  // List variables for curator review
  listVariablesForReview: async (params?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<VariableForReview[]> => {
    const response = await api.get('/curator/variables', { params })
    return response.data
  },

  // Apply a table correction to a variable
  correctTableSuggestion: async (
    variableId: number,
    request: CorrectionRequest
  ): Promise<Correction> => {
    const response = await api.post(
      `/curator/variables/${variableId}/correct`,
      request
    )
    return response.data
  },

  // Get correction history
  getCorrectionHistory: async (params?: {
    my_corrections?: boolean
    limit?: number
    offset?: number
  }): Promise<Correction[]> => {
    const response = await api.get('/curator/corrections', { params })
    return response.data
  },

  // Get correction details
  getCorrectionById: async (correctionId: number): Promise<Correction> => {
    const response = await api.get(`/curator/corrections/${correctionId}`)
    return response.data
  },

  // Get curator stats
  getStats: async (): Promise<CuratorStats> => {
    const response = await api.get('/curator/stats')
    return response.data
  },
}

export default curatorService
