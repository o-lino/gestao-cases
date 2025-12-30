import api from './api'

export interface CaseVariable {
  id?: number
  variable_name: string
  variable_value?: any
  variable_type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  is_required?: boolean
  product?: string
  concept?: string
  min_history?: string
  priority?: string
  desired_lag?: string
  options?: string
  // Cancellation fields
  search_status?: string
  is_cancelled?: boolean
  cancelled_at?: string
  cancellation_reason?: string
}

export interface Case {
  id: number
  title: string
  description?: string
  client_name?: string
  requester_email?: string
  macro_case?: string
  context?: string
  impact?: string
  necessity?: string
  impacted_journey?: string
  impacted_segment?: string
  impacted_customers?: string
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED' | 'CANCELLED'
  created_by: number
  assigned_to_id?: number
  estimated_use_date?: string
  created_at: string
  updated_at: string
  variables: CaseVariable[]
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export const caseService = {
  getAll: async (filters?: { status?: string; created_by?: number }) => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.created_by) params.append('created_by', filters.created_by.toString())
    
    const response = await api.get<PaginatedResponse<Case>>(`/cases?${params.toString()}`)
    return response.data.items
  },

  getById: async (id: number) => {
    const response = await api.get<Case>(`/cases/${id}`)
    return response.data
  },

  create: async (data: Omit<Case, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'variables'> & { variables?: CaseVariable[] }) => {
    const response = await api.post<Case>('/cases/', data)
    return response.data
  },

  update: async (id: number, data: any) => {
    const response = await api.patch<Case>(`/cases/${id}`, data)
    return response.data
  },

  transition: async (id: number, targetStatus: string) => {
    const response = await api.post<Case>(`/cases/${id}/transition`, null, {
      params: { target_status: targetStatus }
    })
    return response.data
  },

  getHistory: async (id: number) => {
    const response = await api.get<any[]>(`/cases/${id}/history`)
    return response.data
  },

  getDocuments: async (id: number) => {
    const response = await api.get<any[]>(`/cases/${id}/documents`)
    return response.data
  },

  uploadDocument: async (id: number, file: File) => {
    // 1. Get upload URL
    const uploadRes = await api.post('/files/upload-url', {
      filename: file.name,
      content_type: file.type
    })
    const { upload_url, object_name } = uploadRes.data

    // 2. Upload to S3 (using fetch to avoid default axios headers)
    await fetch(upload_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })

    // 3. Register document
    const response = await api.post(`/cases/${id}/documents`, {
      filename: file.name,
      s3_key: object_name
    })
    return response.data
  },

  getComments: async (id: number) => {
    const response = await api.get<any[]>(`/cases/${id}/comments`)
    return response.data
  },

  createComment: async (id: number, content: string) => {
    const response = await api.post(`/cases/${id}/comments`, { content })
    return response.data
  },

  getSummary: async (id: number) => {
    const response = await api.post(`/cases/${id}/summarize`)
    return response.data
  },

  getRiskAssessment: async (id: number) => {
    const response = await api.post(`/cases/${id}/risk-assessment`)
    return response.data
  },

  delete: async (id: number) => {
    await api.delete(`/cases/${id}`)
  },

  deleteBulk: async (ids: number[]) => {
    // Delete cases one by one (could be a bulk endpoint in the future)
    await Promise.all(ids.map(id => api.delete(`/cases/${id}`)))
  },

  // Variable management
  addVariable: async (caseId: number, variable: Omit<CaseVariable, 'id' | 'is_cancelled' | 'cancelled_at' | 'cancellation_reason' | 'search_status'>) => {
    const response = await api.post<CaseVariable>(`/cases/${caseId}/variables`, variable)
    return response.data
  },

  cancelVariable: async (caseId: number, variableId: number, reason?: string) => {
    const response = await api.patch<CaseVariable>(`/cases/${caseId}/variables/${variableId}/cancel`, { reason })
    return response.data
  },

  deleteVariable: async (caseId: number, variableId: number) => {
    await api.delete(`/cases/${caseId}/variables/${variableId}`)
  },

  deleteVariablesBulk: async (caseId: number, variableIds: number[]) => {
    await Promise.all(variableIds.map(id => api.delete(`/cases/${caseId}/variables/${id}`)))
  },

  // Case cancellation
  cancel: async (id: number, reason?: string) => {
    const response = await api.post<Case>(`/cases/${id}/cancel`, { reason })
    return response.data
  }
}

