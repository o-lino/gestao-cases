/**
 * History-related TypeScript types
 */

// Evento de histórico de um case
export interface HistoryEvent {
  id: number
  action: string
  actor_name?: string
  actor_id?: number
  created_at: string
  details?: Record<string, unknown>
  old_status?: string
  new_status?: string
}

// Informações de ação para exibição (cor e texto)
export interface ActionInfo {
  text: string
  color: string
}

// Tipos de ações possíveis no histórico
export type HistoryActionType = 
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'comment_added'
  | 'document_uploaded'
  | 'variable_added'
  | 'variable_cancelled'
  | 'match_approved'
  | 'match_rejected'
