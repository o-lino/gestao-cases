/**
 * Admin Config Service
 * API client for system configuration and approval management
 */

import api from './api'
import { CollaboratorBrief } from './hierarchyService'

// Configuration Types
export interface SystemConfig {
  id: number
  configKey: string
  configValue: string
  configType: 'string' | 'number' | 'boolean' | 'json'
  description: string | null
  category: string
  updatedBy: number | null
  updatedAt: string
  createdAt: string
  parsedValue: any
}

export interface ApprovalConfig {
  caseApprovalRequired: boolean
  approvalSlaHours: number
}

export interface EscalationConfig {
  escalationEnabled: boolean
  escalationSlaHours: number
  escalationMaxLevel: number
  escalationReminderHours: number
}

export interface ConfigSummary {
  approval: ApprovalConfig
  escalation: EscalationConfig
}

// Approval Types
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED'

export interface CaseBrief {
  id: number
  title: string
  status: string
  createdAt: string
}

export interface PendingApproval {
  id: number
  caseId: number
  approverId: number
  requesterId: number
  escalationLevel: number
  status: ApprovalStatus
  requestedAt: string
  slaDeadline: string | null
  respondedAt: string | null
  escalatedAt: string | null
  responseNotes: string | null
  rejectionReason: string | null
  reminderCount: number
  isOverdue: boolean
  hoursUntilDeadline: number
  case: CaseBrief | null
  approver: CollaboratorBrief | null
  requester: CollaboratorBrief | null
}

export interface ApprovalStats {
  totalPending: number
  totalOverdue: number
  approvedToday: number
  rejectedToday: number
  averageResponseHours: number
  escalatedCount: number
}

// Transform functions
function transformConfig(data: any): SystemConfig {
  return {
    id: data.id,
    configKey: data.config_key,
    configValue: data.config_value,
    configType: data.config_type,
    description: data.description,
    category: data.category,
    updatedBy: data.updated_by,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
    parsedValue: data.parsed_value
  }
}

function transformApproval(data: any): PendingApproval {
  return {
    id: data.id,
    caseId: data.case_id,
    approverId: data.approver_id,
    requesterId: data.requester_id,
    escalationLevel: data.escalation_level,
    status: data.status,
    requestedAt: data.requested_at,
    slaDeadline: data.sla_deadline,
    respondedAt: data.responded_at,
    escalatedAt: data.escalated_at,
    responseNotes: data.response_notes,
    rejectionReason: data.rejection_reason,
    reminderCount: data.reminder_count,
    isOverdue: data.is_overdue,
    hoursUntilDeadline: data.hours_until_deadline,
    case: data.case ? {
      id: data.case.id,
      title: data.case.title,
      status: data.case.status,
      createdAt: data.case.created_at
    } : null,
    approver: data.approver,
    requester: data.requester
  }
}

function transformConfigSummary(data: any): ConfigSummary {
  return {
    approval: {
      caseApprovalRequired: data.approval.case_approval_required,
      approvalSlaHours: data.approval.approval_sla_hours
    },
    escalation: {
      escalationEnabled: data.escalation.escalation_enabled,
      escalationSlaHours: data.escalation.escalation_sla_hours,
      escalationMaxLevel: data.escalation.escalation_max_level,
      escalationReminderHours: data.escalation.escalation_reminder_hours
    }
  }
}

function transformApprovalStats(data: any): ApprovalStats {
  return {
    totalPending: data.total_pending,
    totalOverdue: data.total_overdue,
    approvedToday: data.approved_today,
    rejectedToday: data.rejected_today,
    averageResponseHours: data.average_response_hours,
    escalatedCount: data.escalated_count
  }
}

// API Functions
export const adminConfigService = {
  // ============ Configuration ============
  
  /**
   * List all configurations
   */
  async listConfigs(category?: string): Promise<SystemConfig[]> {
    const params = category ? { category } : {}
    const response = await api.get('/admin/config', { params })
    return response.data.map(transformConfig)
  },

  /**
   * Get configuration summary
   */
  async getConfigSummary(): Promise<ConfigSummary> {
    const response = await api.get('/admin/config/summary')
    return transformConfigSummary(response.data)
  },

  /**
   * Get a specific configuration
   */
  async getConfig(key: string): Promise<SystemConfig> {
    const response = await api.get(`/admin/config/${key}`)
    return transformConfig(response.data)
  },

  /**
   * Set a configuration value
   */
  async setConfig(key: string, value: string, description?: string, category?: string): Promise<SystemConfig> {
    const response = await api.put(`/admin/config/${key}`, {
      config_value: value,
      description,
      category
    })
    return transformConfig(response.data)
  },

  /**
   * Initialize default configurations
   */
  async initializeDefaults(): Promise<{ message: string }> {
    const response = await api.post('/admin/config/initialize')
    return response.data
  },

  // ============ Approvals ============

  /**
   * Get pending approvals for current user
   */
  async getPendingApprovals(): Promise<PendingApproval[]> {
    const response = await api.get('/admin/approvals/pending')
    return response.data.map(transformApproval)
  },

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    const response = await api.get('/admin/approvals/stats')
    return transformApprovalStats(response.data)
  },

  /**
   * Get approval history for a case
   */
  async getApprovalHistory(caseId: number): Promise<PendingApproval[]> {
    const response = await api.get(`/admin/approvals/case/${caseId}`)
    return response.data.map(transformApproval)
  },

  /**
   * Get a specific approval
   */
  async getApproval(approvalId: number): Promise<PendingApproval> {
    const response = await api.get(`/admin/approvals/${approvalId}`)
    return transformApproval(response.data)
  },

  /**
   * Approve a case
   */
  async approveCase(approvalId: number, notes?: string): Promise<PendingApproval> {
    const response = await api.post(`/admin/approvals/${approvalId}/approve`, { notes })
    return transformApproval(response.data)
  },

  /**
   * Reject a case
   */
  async rejectCase(approvalId: number, reason: string): Promise<PendingApproval> {
    const response = await api.post(`/admin/approvals/${approvalId}/reject`, { reason })
    return transformApproval(response.data)
  },

  /**
   * Process overdue escalations (admin only)
   */
  async processEscalations(): Promise<{ message: string }> {
    const response = await api.post('/admin/approvals/process-escalations')
    return response.data
  },

  /**
   * Send reminders (admin only)
   */
  async sendReminders(): Promise<{ message: string }> {
    const response = await api.post('/admin/approvals/send-reminders')
    return response.data
  }
}

export default adminConfigService
