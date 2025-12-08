/**
 * Moderation Service
 * 
 * Handles moderator-user associations API calls
 */

import api from './api'

// Types
export interface ModerationRequest {
  id: number
  moderator_id: number
  moderator_name: string | null
  moderator_email: string | null
  user_id: number
  user_name: string | null
  user_email: string | null
  duration: string
  duration_label: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'
  message: string | null
  rejection_reason: string | null
  is_renewal: boolean
  requested_at: string
  responded_at: string | null
  expires_at: string
  is_pending: boolean
}

export interface ModerationAssociation {
  id: number
  moderator_id: number
  moderator_name: string | null
  moderator_email: string | null
  user_id: number
  user_name: string | null
  user_email: string | null
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  started_at: string
  expires_at: string
  days_remaining: number
  is_active: boolean
}

export interface UserSummary {
  id: number
  name: string
  email: string
  role: string
}

export interface DurationOption {
  value: string
  label: string
  days: number
}

export type ModerationDuration = '1_MONTH' | '3_MONTHS' | '6_MONTHS'

// Request creation payload
export interface CreateModerationRequestPayload {
  user_id: number
  duration?: ModerationDuration
  message?: string
  is_renewal?: boolean
  previous_association_id?: number
}

// Service
export const moderationService = {
  // ============== Requests ==============
  
  /**
   * Create a moderation request (moderator only)
   */
  createRequest: async (data: CreateModerationRequestPayload): Promise<ModerationRequest> => {
    const response = await api.post('/moderation/requests', data)
    return response.data
  },
  
  /**
   * List moderation requests
   * @param type - 'sent', 'received', or 'all'
   */
  getRequests: async (type: 'sent' | 'received' | 'all' = 'all'): Promise<ModerationRequest[]> => {
    const response = await api.get('/moderation/requests', { params: { type } })
    return response.data
  },
  
  /**
   * Get a specific request by ID
   */
  getRequest: async (requestId: number): Promise<ModerationRequest> => {
    const response = await api.get(`/moderation/requests/${requestId}`)
    return response.data
  },
  
  /**
   * Approve a moderation request (user only)
   */
  approveRequest: async (requestId: number): Promise<ModerationAssociation> => {
    const response = await api.post(`/moderation/requests/${requestId}/approve`)
    return response.data
  },
  
  /**
   * Reject a moderation request (user only)
   */
  rejectRequest: async (requestId: number, reason?: string): Promise<void> => {
    await api.post(`/moderation/requests/${requestId}/reject`, { reason })
  },
  
  /**
   * Cancel a moderation request (moderator only)
   */
  cancelRequest: async (requestId: number): Promise<void> => {
    await api.post(`/moderation/requests/${requestId}/cancel`)
  },
  
  // ============== Associations ==============
  
  /**
   * List all associations for current user
   */
  getAssociations: async (): Promise<ModerationAssociation[]> => {
    const response = await api.get('/moderation/associations')
    return response.data
  },
  
  /**
   * Revoke an active association
   */
  revokeAssociation: async (associationId: number): Promise<void> => {
    await api.post(`/moderation/associations/${associationId}/revoke`)
  },
  
  // ============== Convenience ==============
  
  /**
   * Get current user's active moderator
   */
  getMyModerator: async (): Promise<UserSummary | null> => {
    const response = await api.get('/moderation/my-moderator')
    return response.data
  },
  
  /**
   * Get users being moderated by current user (moderator only)
   */
  getMyUsers: async (): Promise<Array<{ user: UserSummary; association: ModerationAssociation }>> => {
    const response = await api.get('/moderation/my-users')
    return response.data
  },
  
  /**
   * Get users available for moderation (not already associated)
   */
  getAvailableUsers: async (): Promise<UserSummary[]> => {
    const response = await api.get('/moderation/available-users')
    return response.data
  },
  
  /**
   * Get duration options
   */
  getDurationOptions: async (): Promise<DurationOption[]> => {
    const response = await api.get('/moderation/duration-options')
    return response.data
  },
}

// Duration labels for frontend use
export const DURATION_LABELS: Record<ModerationDuration, string> = {
  '1_MONTH': '1 mês',
  '3_MONTHS': '3 meses',
  '6_MONTHS': '6 meses',
}

// Status labels
export const REQUEST_STATUS_LABELS: Record<ModerationRequest['status'], string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
}

export const ASSOCIATION_STATUS_LABELS: Record<ModerationAssociation['status'], string> = {
  ACTIVE: 'Ativa',
  EXPIRED: 'Expirada',
  REVOKED: 'Revogada',
}

// Status colors for badges
export const REQUEST_STATUS_COLORS: Record<ModerationRequest['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
}

export const ASSOCIATION_STATUS_COLORS: Record<ModerationAssociation['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  REVOKED: 'bg-red-100 text-red-800',
}
