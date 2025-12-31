/**
 * Variable-related TypeScript types
 * Centralized type definitions to eliminate `any` usage
 */

// Status de busca de variável
export type VariableSearchStatus = 
  | 'PENDING' 
  | 'SEARCHING' 
  | 'AI_SEARCHING'
  | 'MATCHED' 
  | 'OWNER_REVIEW'
  | 'REQUESTER_REVIEW'
  | 'PENDING_INVOLVEMENT'
  | 'APPROVED'

// Informações de match de uma variável (usado no estado do componente)
export interface VariableMatchInfo {
  status: VariableSearchStatus
  matchCount: number
  topScore?: number
  selectedTable?: string
  concept?: string
  desiredLag?: string
  selectedTableId?: number
  selectedTableDomain?: string
  selectedTableOwnerName?: string
  selectedTableDescription?: string
  selectedTableFullPath?: string
  matchStatus?: string
  isPendingOwner: boolean
  isApproved: boolean
}

// Detalhes expandidos de uma variável (para o modal de detalhes)
export interface VariableDetail {
  id: number
  variable_name: string
  variable_type: string
  concept?: string
  desired_lag?: string
  search_status: VariableSearchStatus
  match_count: number
  top_score?: number
  selected_table?: string
  selected_table_id?: number
  selected_table_domain?: string
  selected_table_owner_name?: string
  selected_table_description?: string
  selected_table_full_path?: string
  match_status?: string
  is_pending_owner: boolean
  is_pending_requester: boolean
  is_approved: boolean
}

// Item de progresso de variável retornado pela API
export interface VariableProgressItem {
  id: number
  search_status: VariableSearchStatus
  match_count: number
  top_score?: number
  selected_table?: string
  concept?: string
  desired_lag?: string
  selected_table_id?: number
  selected_table_domain?: string
  selected_table_owner_name?: string
  selected_table_description?: string
  selected_table_full_path?: string
  match_status?: string
  is_pending_owner?: boolean
  is_approved?: boolean
}

// Progresso geral de um case
export interface CaseProgress {
  progress_percent: number
  pending: number
  matched: number
  approved: number
  variables: VariableProgressItem[]
}

// Tipo do valor de uma variável (substituindo `any`)
export type VariableValue = string | number | boolean | Date | null | undefined
