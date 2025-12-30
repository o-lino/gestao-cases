/**
 * Involvement Service
 * 
 * API service for managing involvement requests (data creation requests).
 */

import api from './api';

// Types
export interface Involvement {
  id: number;
  caseVariableId: number;
  externalRequestNumber: string;
  externalSystem?: string;
  requesterId: number;
  requesterName?: string;
  ownerId: number;
  ownerName?: string;
  status: InvolvementStatus;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
  createdTableName?: string;
  createdConcept?: string;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number;
  notes?: string;
  reminderCount: number;
  lastReminderAt?: string;
  createdAt: string;
  updatedAt?: string;
  variableName?: string;
  caseId?: number;
  caseTitle?: string;
}

export type InvolvementStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface CreateInvolvementRequest {
  case_variable_id: number;
  external_request_number: string;
  external_system?: string;
  notes?: string;
}

export interface SetDateRequest {
  expected_completion_date: string; // ISO date format YYYY-MM-DD
  notes?: string;
}

export interface CompleteInvolvementRequest {
  created_table_name: string;
  created_concept: string;
  notes?: string;
}

export interface InvolvementListResponse {
  items: Involvement[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface InvolvementStats {
  total: number;
  pending: number;
  inProgress: number;
  overdue: number;
  completed: number;
  avgCompletionDays?: number;
}

// Helper to convert snake_case response to camelCase
const transformInvolvement = (data: any): Involvement => ({
  id: data.id,
  caseVariableId: data.case_variable_id,
  externalRequestNumber: data.external_request_number,
  externalSystem: data.external_system,
  requesterId: data.requester_id,
  requesterName: data.requester_name,
  ownerId: data.owner_id,
  ownerName: data.owner_name,
  status: data.status,
  expectedCompletionDate: data.expected_completion_date,
  actualCompletionDate: data.actual_completion_date,
  createdTableName: data.created_table_name,
  createdConcept: data.created_concept,
  isOverdue: data.is_overdue,
  daysOverdue: data.days_overdue,
  daysUntilDue: data.days_until_due,
  notes: data.notes,
  reminderCount: data.reminder_count,
  lastReminderAt: data.last_reminder_at,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  variableName: data.variable_name,
  caseId: data.case_id,
  caseTitle: data.case_title,
});

// API Functions
export const involvementService = {
  /**
   * Create a new involvement request
   */
  create: async (data: CreateInvolvementRequest): Promise<Involvement> => {
    const response = await api.post('/involvements/', data);
    return transformInvolvement(response.data);
  },

  /**
   * List involvements with optional filters
   */
  list: async (params?: {
    ownerId?: number;
    requesterId?: number;
    status?: InvolvementStatus;
    includeCompleted?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<InvolvementListResponse> => {
    const response = await api.get('/involvements/', { 
      params: {
        owner_id: params?.ownerId,
        requester_id: params?.requesterId,
        status: params?.status,
        include_completed: params?.includeCompleted,
        skip: params?.skip,
        limit: params?.limit,
      }
    });
    return {
      items: response.data.items.map(transformInvolvement),
      total: response.data.total,
      page: response.data.page,
      size: response.data.size,
      pages: response.data.pages,
    };
  },

  /**
   * Get pending involvements for current user (as owner)
   */
  getMyPending: async (): Promise<Involvement[]> => {
    const response = await api.get('/involvements/my-pending');
    return response.data.map(transformInvolvement);
  },

  /**
   * Get involvements requested by current user
   */
  getMyRequests: async (includeCompleted = false): Promise<Involvement[]> => {
    const response = await api.get('/involvements/my-requests', {
      params: { include_completed: includeCompleted }
    });
    return response.data.map(transformInvolvement);
  },

  /**
   * Get involvement for a specific variable
   */
  getForVariable: async (variableId: number): Promise<Involvement | null> => {
    const response = await api.get(`/involvements/variable/${variableId}`);
    return response.data ? transformInvolvement(response.data) : null;
  },

  /**
   * Get involvement by ID
   */
  getById: async (involvementId: number): Promise<Involvement> => {
    const response = await api.get(`/involvements/${involvementId}`);
    return transformInvolvement(response.data);
  },

  /**
   * Set expected completion date (owner only)
   */
  setDate: async (involvementId: number, data: SetDateRequest): Promise<Involvement> => {
    const response = await api.patch(`/involvements/${involvementId}/set-date`, data);
    return transformInvolvement(response.data);
  },

  /**
   * Complete involvement with created table info (owner only)
   */
  complete: async (involvementId: number, data: CompleteInvolvementRequest): Promise<Involvement> => {
    const response = await api.patch(`/involvements/${involvementId}/complete`, data);
    return transformInvolvement(response.data);
  },

  /**
   * Get involvement statistics
   */
  getStats: async (ownerId?: number): Promise<InvolvementStats> => {
    const response = await api.get('/involvements/stats', {
      params: ownerId ? { owner_id: ownerId } : undefined
    });
    return {
      total: response.data.total,
      pending: response.data.pending,
      inProgress: response.data.in_progress,
      overdue: response.data.overdue,
      completed: response.data.completed,
      avgCompletionDays: response.data.avg_completion_days,
    };
  },

  /**
   * Trigger overdue reminders (admin only)
   */
  sendReminders: async (): Promise<{ message: string }> => {
    const response = await api.post('/involvements/send-overdue-reminders');
    return response.data;
  },
};

export default involvementService;
